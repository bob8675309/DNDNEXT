import dynamic from "next/dynamic";
const LoginPage = dynamic(() => import("../components/LoginPage"), { ssr: false });

export default function Login() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <LoginPage />
    </div>
  );
}