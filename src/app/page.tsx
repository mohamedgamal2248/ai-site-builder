import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function Home() {
  const mcpUrl = `${env.appUrl}/api/mcp`;
  return (
    <main>
      <h1>وصل — اربط متجرك بوكلاء الذكاء الاصطناعي</h1>
      <p>
        سجّل متجرك على سلة أو زد أو WooCommerce مرة واحدة، وخلّي ChatGPT وClaude وGemini وأي وكيل ذكاء اصطناعي يلاقي منتجاتك
        ويجهّز للعميل رابط شراء. <strong>العميل بيدفع دايماً على موقعك إنت</strong> — بالبطاقة أو مدى أو التقسيط أو الدفع عند الاستلام.
      </p>

      <h2>١. اربط متجرك</h2>
      <div className="card">
        <p><strong>WooCommerce</strong> — اكتب رابط متجرك (https):</p>
        <form action="/api/connect/woocommerce" method="get">
          <input name="site" type="url" placeholder="https://mystore.com" required />
          <button type="submit">ربط المتجر</button>
        </form>
      </div>
      <div className="card">
        <p><strong>زد</strong></p>
        <a className="btn" href="/api/connect/zid">ربط متجر زد</a>
      </div>
      <div className="card">
        <p><strong>سلة</strong> — ثبّت تطبيق وصل من متجر تطبيقات سلة (قريباً).</p>
      </div>

      <h2>٢. للمطورين ووكلاء الذكاء الاصطناعي</h2>
      <p>خادم MCP (Streamable HTTP):</p>
      <pre>{mcpUrl}</pre>
      <p>أو REST API:</p>
      <pre>{`GET  ${env.appUrl}/api/v1/products/search?q=عطر&country=SA
GET  ${env.appUrl}/api/v1/products/{id}
POST ${env.appUrl}/api/v1/checkout-links  {"product_id": "...", "quantity": 1}`}</pre>
    </main>
  );
}
