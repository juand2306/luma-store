"""
Script de validacion de la Fase 3 - LUMA STORE SYSTEM
Prueba todos los items del checklist de la fase.
"""
import json
import urllib.request
import urllib.error
import urllib.parse

BASE = "http://localhost:8000/api/v1"
RESULTS = []

def req(method, path, data=None, token=None, public=False):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    try:
        r = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as ex:
        return 0, {"error": str(ex)}

def check(name, condition, detail=""):
    symbol = "PASS" if condition else "FAIL"
    RESULTS.append((symbol, name, detail))
    print(f"  [{symbol}] {name}" + (f" — {detail}" if detail else ""))

print("\n" + "="*60)
print("  FASE 3 — VALIDACIONES DE API")
print("="*60)

# ── 1. Endpoint público store/config ─────────────────────────
print("\n[1] Endpoints públicos")
s, d = req("GET", "/store/config/")
check("GET /store/config/ responde 200 sin token", s == 200, f"status={s}")
check("Devuelve name de la tienda", "name" in d, str(d.get("name","")))
check("NO expone datos sensibles (cost, metrics)", "cost" not in str(d), "no hay cost")

s, d = req("GET", "/store/products/")
check("GET /store/products/ responde 200 sin token", s == 200, f"status={s}")

s, d = req("GET", "/store/categories/")
check("GET /store/categories/ responde 200 sin token", s == 200, f"status={s}")

# ── 2. Login JWT ──────────────────────────────────────────────
print("\n[2] Autenticacion JWT")
s, d = req("POST", "/auth/login/", {"username": "admin", "password": "luma2025"})
check("POST /auth/login/ con credenciales correctas → 200", s == 200, f"status={s}")
TOKEN = d.get("access", "")
check("Respuesta contiene access token", bool(TOKEN), f"token={'OK' if TOKEN else 'MISSING'}")
REFRESH = d.get("refresh", "")
check("Respuesta contiene refresh token", bool(REFRESH), "")

s, d = req("POST", "/auth/login/", {"username": "admin", "password": "wrong"})
check("POST /auth/login/ con credenciales incorrectas → 401", s == 401, f"status={s}")

s, d = req("POST", "/auth/refresh/", {"refresh": REFRESH})
check("POST /auth/refresh/ retorna nuevo access token", s == 200 and "access" in d, f"status={s}")

# ── 3. Endpoints que requieren auth ───────────────────────────
print("\n[3] Proteccion por autenticacion")
s, d = req("GET", "/auth/me/")
check("GET /auth/me/ SIN token → 401", s == 401, f"status={s}")

s, d = req("GET", "/auth/me/", token=TOKEN)
check("GET /auth/me/ CON token → 200 con rol owner", s == 200 and d.get("role") == "owner", f"role={d.get('role')}")

s, d = req("GET", "/inventory/products/")
check("GET /inventory/products/ SIN token → 401", s == 401, f"status={s}")

# ── 4. Permisos por rol ───────────────────────────────────────
print("\n[4] Proteccion por rol")
# Crear usuario seller para prueba
s, d = req("POST", "/auth/users/", {
    "username": "vendedor_test", "password": "test1234",
    "first_name": "Vendedor", "last_name": "Test", "role": "seller"
}, token=TOKEN)
check("Owner puede crear usuario seller", s == 201, f"status={s}")

s2, d2 = req("POST", "/auth/login/", {"username": "vendedor_test", "password": "test1234"})
SELLER_TOKEN = d2.get("access", "")
check("Seller puede hacer login", s2 == 200 and bool(SELLER_TOKEN), f"status={s2}")

s, d = req("GET", "/inventory/products/", token=SELLER_TOKEN)
check("Seller NO puede acceder a /inventory/products/ → 403", s == 403, f"status={s}")

s, d = req("GET", "/auth/users/", token=SELLER_TOKEN)
check("Seller NO puede ver lista de usuarios → 403", s == 403, f"status={s}")

# ── 5. Inventario ─────────────────────────────────────────────
print("\n[5] Modulo de Inventario")
s, cat = req("POST", "/inventory/categories/", {"name": "Ropa Test", "order": 1}, token=TOKEN)
check("Crear categoria → 201", s == 201, f"status={s}")
CAT_ID = cat.get("id")

s, prod = req("POST", "/inventory/products/", {
    "name": "Blusa Test", "price": "45000", "cost": "20000",
    "category": CAT_ID, "is_visible": False, "status": "active"
}, token=TOKEN)
check("Crear producto → 201", s == 201, f"status={s}")
PROD_ID = prod.get("id")
check("Producto tiene sku_base auto-generado", bool(prod.get("sku_base")), prod.get("sku_base",""))

s, var = req("POST", "/inventory/variants/", {
    "product": PROD_ID, "size": "M", "color": "Negro", "stock": 10
}, token=TOKEN)
check("Crear variante → 201", s == 201, f"status={s}")
VAR_ID = var.get("id")
check("Variante tiene SKU auto-generado", bool(var.get("sku")), var.get("sku",""))

# Movimiento de entrada de stock
s, mov = req("POST", "/inventory/movements/", {
    "variant": VAR_ID, "type": "entry", "quantity": 5, "note": "Entrada de prueba"
}, token=TOKEN)
check("Crear movimiento de entrada → 201", s == 201, f"status={s}")

# Verificar que el stock subió
s, var2 = req("GET", f"/inventory/variants/{VAR_ID}/", token=TOKEN)
check("Stock subio correctamente con movimiento entry (10+5=15)", var2.get("stock") == 15, f"stock={var2.get('stock')}")

# Toggle visible
s, d = req("PATCH", f"/inventory/products/{PROD_ID}/", {"is_visible": True}, token=TOKEN)
check("Toggle is_visible funciona", s == 200, f"status={s}")

s, pub = req("GET", f"/store/products/{PROD_ID}/")
check("Producto visible aparece en portal publico", s == 200, f"status={s}")

# ── 6. Caja ──────────────────────────────────────────────────
print("\n[6] Modulo de Caja")
from datetime import date
s, sess = req("POST", "/cash/sessions/", {
    "date": str(date.today()), "opening_amount": "100000"
}, token=TOKEN)
check("Abrir caja → 201", s == 201, f"status={s}")
SESS_ID = sess.get("id")

# Intentar abrir otra caja el mismo día
s2, d2 = req("POST", "/cash/sessions/", {
    "date": str(date.today()), "opening_amount": "50000"
}, token=TOKEN)
check("NO se puede abrir 2 cajas el mismo dia → 400", s2 == 400, f"status={s2}")

s, d = req("POST", "/cash/movements/", {
    "session": SESS_ID, "type": "expense", "amount": "5000",
    "description": "Gasto de prueba", "payment_method": "cash"
}, token=TOKEN)
check("Registrar egreso manual → 201", s == 201, f"status={s}")

# ── 7. Ventas ────────────────────────────────────────────────
print("\n[7] Modulo de Ventas")
s, sale = req("POST", "/sales/", {
    "items": [{"variant_id": VAR_ID, "quantity": 3}],
    "payment_method": "cash",
    "cash_received": "150000"
}, token=TOKEN)
check("Crear venta con caja abierta → 201", s == 201, f"status={s}")
check("Venta tiene numero auto-generado VTA-", sale.get("number","").startswith("VTA-"), sale.get("number",""))
SALE_ID = sale.get("id")

# Verificar que el stock bajó
s, var3 = req("GET", f"/inventory/variants/{VAR_ID}/", token=TOKEN)
check("Stock bajo automaticamente al vender (15-3=12)", var3.get("stock") == 12, f"stock={var3.get('stock')}")

# Verificar que el ingreso quedó en caja
s, sess2 = req("GET", f"/cash/sessions/{SESS_ID}/", token=TOKEN)
check("Ingreso de venta aparece en caja", float(sess2.get("total_income", 0)) > 0, f"income={sess2.get('total_income')}")

# ── 8. Pedidos (portal publico) ───────────────────────────────
print("\n[8] Pedidos del portal (publico)")
s, order = req("POST", "/store/orders/", {
    "items": [{"variant_id": VAR_ID, "quantity": 1}],
    "customer_name": "Juan Test",
    "customer_phone": "3001234567",
    "note": "Pedido de prueba"
})
check("POST /store/orders/ SIN TOKEN → 201", s == 201, f"status={s}")
check("Pedido tiene numero PED-", order.get("number","").startswith("PED-"), order.get("number",""))
check("Pedido llega en estado 'new'", order.get("status") == "new", f"status={order.get('status')}")
ORDER_ID = order.get("id")

s, orders_list = req("GET", "/orders/", token=TOKEN)
check("Pedido aparece en panel admin", s == 200, f"count={len(orders_list) if isinstance(orders_list, list) else orders_list.get('count', '?')}")

# Stock restante del portal
s, var4 = req("GET", f"/inventory/variants/{VAR_ID}/", token=TOKEN)
check("Stock NO se descontó al crear pedido (solo al vender)", var4.get("stock") == 12, f"stock={var4.get('stock')}")

# ── 9. Dashboard ─────────────────────────────────────────────
print("\n[9] Dashboard y Reportes")
s, dash = req("GET", "/reports/dashboard/", token=TOKEN)
check("GET /reports/dashboard/ → 200", s == 200, f"status={s}")
check("Dashboard tiene today_revenue", "today_revenue" in dash, "")
check("Dashboard tiene new_orders > 0", dash.get("new_orders", 0) >= 1, f"new_orders={dash.get('new_orders')}")
check("Dashboard tiene sales_chart (30 dias)", len(dash.get("sales_chart", [])) == 30, f"dias={len(dash.get('sales_chart',[]))}")
check("Dashboard tiene stock_alerts list", "stock_alerts" in dash, "")
check("Dashboard tiene restock_alerts list", "restock_alerts" in dash, "")

# ── 10. Reportes exportacion ──────────────────────────────────
s, d = req("GET", "/reports/sales/", token=TOKEN)
check("GET /reports/sales/ → 200", s == 200, f"status={s}")
check("Reporte de ventas tiene total_revenue", "total_revenue" in d, "")

s, d = req("GET", "/reports/inventory/", token=TOKEN)
check("GET /reports/inventory/ → 200", s == 200, f"status={s}")

# ── RESUMEN FINAL ──────────────────────────────────────────────
print("\n" + "="*60)
passed = sum(1 for r in RESULTS if r[0] == "PASS")
failed = sum(1 for r in RESULTS if r[0] == "FAIL")
print(f"  RESULTADO: {passed} PASS  |  {failed} FAIL  |  {len(RESULTS)} TOTAL")
if failed:
    print("\n  FALLIDOS:")
    for r in RESULTS:
        if r[0] == "FAIL":
            print(f"    ✗ {r[1]}: {r[2]}")
print("="*60 + "\n")
