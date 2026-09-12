import { Header } from "@/components/layout/Header";
import { GuestLoginHint } from "@/components/layout/GuestLoginHint";
import { MainForm } from "@/components/main/MainForm";

export default function MainPage() {
  return (
    <div className="min-h-dvh">
      <Header />
      <GuestLoginHint />
      <MainForm />
    </div>
  );
}
