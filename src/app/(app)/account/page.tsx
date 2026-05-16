import { permanentRedirect } from "next/navigation";

export default function AccountRedirect() {
  permanentRedirect("/profile");
}
