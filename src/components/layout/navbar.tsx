"use client";

import { NavbarClient } from "./navbar-client";

interface NavbarUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

export function Navbar({
  siteName,
  logoUrl,
  user,
}: {
  siteName: string;
  logoUrl: string;
  user: NavbarUser | null;
}) {
  return <NavbarClient siteName={siteName} logoUrl={logoUrl} user={user} />;
}
