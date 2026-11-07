import { redirect } from "next/navigation";

// Short link to share with clubs: /business
export default function Page() {
    redirect("/register?as=club");
}
