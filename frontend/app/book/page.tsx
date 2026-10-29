import { redirect } from "next/navigation";
import { cars } from "@/config/cars";

// /book on its own goes to the first car's booking page (the only one for now).
export default function BookIndex() {
  redirect(`/book/${cars[0].slug}`);
}
