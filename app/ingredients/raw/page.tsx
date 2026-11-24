import { redirect } from "next/navigation";

export default function RawIngredientsRedirectPage() {
  redirect("/ingredients/food?tab=raw");
}
