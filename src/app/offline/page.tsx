export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="card error-box">
      <h1>You are offline · أنت أوفلاين</h1>
      <p>Blockchain Pi needs a connection to read the Pi blockchain. · الموقع محتاج إنترنت عشان يقرا بلوكتشين Pi.</p>
    </div>
  );
}
