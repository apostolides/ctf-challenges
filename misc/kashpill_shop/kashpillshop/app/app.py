import os, uuid, subprocess, tempfile
from flask import Flask, render_template, request, send_file, abort

app = Flask(__name__)

PRODUCTS = [
    {"id": "1", "name": "BlissX 500mg",     "price": "0.0032 BTC", "desc": "EU certified. Discreet packaging. Untraceable.",          "badge": "BESTSELLER", "bc": "hot"},
    {"id": "2", "name": "KashBlue 10mg",    "price": "0.0018 BTC", "desc": "Our signature formula. Trusted by thousands.",            "badge": "SALE",       "bc": "sale"},
    {"id": "3", "name": "Clarity Pro",       "price": "0.0055 BTC", "desc": "Focus. Think. Execute. No prescription needed.",         "badge": "LIMITED",    "bc": "limited"},
    {"id": "4", "name": "NightFall 20mg",    "price": "0.0099 BTC", "desc": "Premium grade. Deep rest guaranteed.",                   "badge": "VIP",        "bc": "hot"},
    {"id": "5", "name": "Euphoria XT",       "price": "0.0041 BTC", "desc": "Handle with care. Last batch was gone in 48h.",         "badge": "NEW",        "bc": "new"},
    {"id": "6", "name": "Red Dream Caps",    "price": "0.0027 BTC", "desc": "Seasonal special. End of stock.",                        "badge": "SALE",       "bc": "sale"},
    {"id": "7", "name": "White Crystal 5g",  "price": "0.0210 BTC", "desc": "Lab tested 98.4% purity. Ships in 24h.",                "badge": "HOT",        "bc": "hot"},
    {"id": "8", "name": "Greenz Premium",    "price": "0.0015 BTC", "desc": "Indoor grown. Top shelf quality.",                       "badge": "NEW",        "bc": "new"},
]

PRODUCTS_MAP = {p["id"]: p for p in PRODUCTS}


@app.route("/")
def index():
    return render_template("index.html", products=PRODUCTS)


@app.route("/product/<pid>")
def product(pid):
    p = PRODUCTS_MAP.get(pid)
    if not p:
        abort(404)
    return render_template("product.html", product=p)


@app.route("/checkout/<pid>", methods=["GET", "POST"])
def checkout(pid):
    p = PRODUCTS_MAP.get(pid)
    if not p:
        abort(404)
    if request.method == "POST":
        name     = request.form.get("name", "")
        address  = request.form.get("address", "")
        qty      = request.form.get("qty", "1")
        order_id = uuid.uuid4().hex[:8].upper()
        return make_receipt(p, name, address, qty, order_id)
    return render_template("checkout.html", product=p)


def make_receipt(product, name, address, qty, order_id):
    # Build receipt HTML directly - name and address inserted as-is
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body {{
    font-family: 'Courier New', monospace;
    padding: 48px;
    color: #1a1a1a;
    font-size: 13px;
    line-height: 1.6;
  }}
  h1 {{
    font-size: 15px;
    letter-spacing: 4px;
    text-transform: uppercase;
    border-bottom: 2px solid #000;
    padding-bottom: 12px;
    margin-bottom: 24px;
  }}
  .row {{
    display: flex;
    margin-bottom: 8px;
  }}
  .lbl {{
    width: 150px;
    font-weight: bold;
    flex-shrink: 0;
    color: #444;
  }}
  .val {{ flex: 1; }}
  hr {{
    border: none;
    border-top: 1px dashed #bbb;
    margin: 20px 0;
  }}
  .footer {{
    font-size: 10px;
    color: #999;
    margin-top: 36px;
  }}
</style>
</head>
<body>
<h1>KashPillShop - Order Receipt</h1>

<div class="row"><span class="lbl">Order ID</span><span class="val">#{order_id}</span></div>
<div class="row"><span class="lbl">Item</span><span class="val">{product['name']}</span></div>
<div class="row"><span class="lbl">Quantity</span><span class="val">{qty}</span></div>
<div class="row"><span class="lbl">Total</span><span class="val">{product['price']}</span></div>

<hr/>

<div class="row"><span class="lbl">Ship To</span><span class="val">{name}</span></div>
<div class="row"><span class="lbl">Address</span><span class="val">{address}</span></div>

<hr/>

<div class="footer">
  Receipt generated automatically. Keep for your records.<br/>
  All sales are final. No refunds. No returns. No traces.
</div>
</body>
</html>"""

    tmp   = tempfile.mkdtemp()
    fhtml = os.path.join(tmp, f"{order_id}.html")
    fpdf  = os.path.join(tmp, f"{order_id}.pdf")

    with open(fhtml, "w") as f:
        f.write(html)

    subprocess.run([
        "wkhtmltopdf",
        "--allow", "/",
        "--enable-local-file-access",
        "--enable-javascript",
        "--no-stop-slow-scripts",
        "--javascript-delay", "1500",
        "--quiet",
        "--load-error-handling", "ignore",
        fhtml, fpdf,
    ], timeout=20)

    os.unlink(fhtml)

    resp = send_file(fpdf, as_attachment=True,
                     download_name=f"receipt_{order_id}.pdf",
                     mimetype="application/pdf")

    @resp.call_on_close
    def _cleanup():
        try:
            os.unlink(fpdf)
            os.rmdir(tmp)
        except Exception:
            pass

    return resp


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
