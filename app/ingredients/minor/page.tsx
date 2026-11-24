import { redirect } from "next/navigation";

export default function MinorIngredientsRedirectPage() {
  redirect("/ingredients/food?tab=minor");
}
