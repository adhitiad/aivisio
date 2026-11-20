import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { db } from '../src/lib/db'
import { projectDir } from '../src/lib/video/config'
import { headObject, isNeonStorageConfigured, putFile } from '../src/lib/storage/neon-object-storage'

type SceneRecord = { idx?: number; thumbObjectKey?: string; [key: string]: unknown }

const apply = process.argv.includes('--apply')
let migrated = 0
let skipped = 0
let failed = 0

function shaMatches(head: { size: number; sha256: string | null } | null, size: number, sha256: string): boolean {
  return Boolean(head && head.size === size && head.sha256 === sha256)
}

async function ensureFile(filePath: string): Promise<boolean> {
  try { return (await fs.stat(filePath)).isFile() } catch { return false }
}

async function saveRecord(input: {
  userId: string | null
  projectId: string
  kind: string
  objectKey: string
  mimeType: string
  size: number
  sha256: string
  originalName: string
}) {
  await db.mediaAsset.upsert({
    where: { objectKey: input.objectKey },
    create: {
      userId: input.userId,
      videoProjectId: input.projectId,
      kind: input.kind,
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.size),
      sha256: input.sha256,
      originalName: input.originalName,
    },
    update: {
      sizeBytes: BigInt(input.size),
      sha256: input.sha256,
      originalName: input.originalName,
    },
  })
}

async function migrate(): Promise<void> {
  if (!isNeonStorageConfigured()) throw new Error('Neon Object Storage belum dikonfigurasi.')
  console.log(apply ? 'MODE APPLY: file akan diunggah dan pointer database diperbarui.' : 'DRY RUN: tidak ada file atau database yang diubah.')
  const projects = await db.videoProject.findMany({
    select: { id: true, userId: true, filePath: true, fileObjectKey: true, scenes: true },
    orderBy: { createdAt: 'asc' },
  })
  for (const project of projects) {
    const ownerPrefix = project.userId || 'system'
    const prefix = 'media/users/' + ownerPrefix + '/projects/' + project.id
    if (project.fileObjectKey) {
      skipped++
    } else if (project.filePath && await ensureFile(project.filePath)) {
      const key = prefix + '/final/video.mp4'
      if (apply) {
        try {
          const uploaded = await putFile(key, project.filePath, 'video/mp4')
          if (!shaMatches(await headObject(key), uploaded.size, uploaded.sha256)) throw new Error('HEAD/checksum tidak cocok.')
          await saveRecord({
            userId: project.userId, projectId: project.id, kind: 'final_video',
            objectKey: key, mimeType: 'video/mp4', size: uploaded.size,
            sha256: uploaded.sha256, originalName: 'final.mp4',
          })
          await db.videoProject.update({ where: { id: project.id }, data: { fileObjectKey: key, filePath: null, fileBytes: uploaded.size } })
          migrated++
        } catch (error) {
          failed++
          console.error('Gagal migrasi video project ' + project.id + ':', error instanceof Error ? error.message : String(error))
        }
      } else {
        console.log('VIDEO ' + project.id + ' -> ' + key)
      }
    } else if (project.filePath) {
      skipped++
      console.warn('File lokal tidak ditemukan untuk project ' + project.id + ': ' + project.filePath)
    }

    let scenes: SceneRecord[] = []
    try {
      const parsed = JSON.parse(project.scenes)
      if (Array.isArray(parsed)) scenes = parsed as SceneRecord[]
    } catch {
      scenes = []
    }
    let sceneChanged = false
    for (const scene of scenes) {
      const idx = Number(scene.idx)
      if (!Number.isInteger(idx) || idx < 1 || scene.thumbObjectKey) continue
      const localPath = path.join(projectDir(project.id), 'scene-' + idx + '.jpg')
      if (!(await ensureFile(localPath))) continue
      const key = prefix + '/scenes/scene-' + idx + '.jpg'
      if (!apply) {
        console.log('SCENE ' + project.id + '/' + idx + ' -> ' + key)
        continue
      }
      try {
        const uploaded = await putFile(key, localPath, 'image/jpeg')
        if (!shaMatches(await headObject(key), uploaded.size, uploaded.sha256)) throw new Error('HEAD/checksum tidak cocok.')
        await saveRecord({
          userId: project.userId, projectId: project.id, kind: 'scene_thumbnail',
          objectKey: key, mimeType: 'image/jpeg', size: uploaded.size,
          sha256: uploaded.sha256, originalName: 'scene-' + idx + '.jpg',
        })
        scene.thumbObjectKey = key
        sceneChanged = true
        migrated++
      } catch (error) {
        failed++
        console.error('Gagal migrasi scene ' + project.id + '/' + idx + ':', error instanceof Error ? error.message : String(error))
      }
    }
    if (apply && sceneChanged) {
      await db.videoProject.update({ where: { id: project.id }, data: { scenes: JSON.stringify(scenes) } })
    }
  }

  const variants = await db.thumbnailVariant.findMany({
    where: { objectKey: null, imagePath: { not: null } },
    select: { id: true, userId: true, videoProjectId: true, imagePath: true },
    orderBy: { createdAt: 'asc' },
  })
  for (const variant of variants) {
    if (!variant.imagePath || !(await ensureFile(variant.imagePath))) {
      skipped++
      continue
    }
    const key = 'media/users/' + variant.userId + '/projects/' + variant.videoProjectId + '/thumbnails/' + variant.id + '.png'
    if (!apply) {
      console.log('THUMBNAIL ' + variant.id + ' -> ' + key)
      continue
    }
    try {
      const uploaded = await putFile(key, variant.imagePath, 'image/png')
      if (!shaMatches(await headObject(key), uploaded.size, uploaded.sha256)) throw new Error('HEAD/checksum tidak cocok.')
      await saveRecord({
        userId: variant.userId, projectId: variant.videoProjectId, kind: 'thumbnail_variant',
        objectKey: key, mimeType: 'image/png', size: uploaded.size,
        sha256: uploaded.sha256, originalName: variant.id + '.png',
      })
      await db.thumbnailVariant.update({ where: { id: variant.id }, data: { objectKey: key, imagePath: null } })
      migrated++
    } catch (error) {
      failed++
      console.error('Gagal migrasi thumbnail ' + variant.id + ':', error instanceof Error ? error.message : String(error))
    }
  }

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', migrated, skipped, failed }, null, 2))
  if (failed) process.exitCode = 1
}

migrate().catch((error) => {
  console.error('Media migration failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}).finally(async () => {
  await db.$disconnect()
})
