import { redirect } from "next/navigation";

export default function NetIngredientsRedirectPage() {
  redirect("/ingredients/food?tab=net");
}
