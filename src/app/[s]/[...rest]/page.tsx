import { notFound } from "next/navigation";

/** Any unknown path under the site renders the 404 page inside the normal layout. */
export default function CatchAll() {
  notFound();
}
