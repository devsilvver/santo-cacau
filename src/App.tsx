import { useState, useMemo, useEffect } from "react";
import { MapPin, Store, ShoppingBag } from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";

// ==========================================
// CONFIGURAÇÃO DO FIREBASE (COLE AQUI SUAS CHAVES)
// ==========================================
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

type DeliveryType = "entrega" | "retirada";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
  stock_quantity: number;
}

const CATEGORIES = ["Todos", "Brigadeiros", "Bolos", "Brownies", "Combos"];

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Inicializa o carrinho buscando do localStorage
  const [cart, setCart] = useState<Record<string, number>>(() => {
    const savedCart = localStorage.getItem("@santo-cacau:cart");
    if (savedCart) {
      try {
        return JSON.parse(savedCart);
      } catch (e) {}
    }
    return {};
  });

  const [activeCategory, setActiveCategory] = useState("Todos");
  const [customerName, setCustomerName] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("entrega");
  const [address, setAddress] = useState("");
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Lê os dados do Firebase em Tempo Real
  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedProducts: Product[] = [];
      snapshot.forEach((doc) => {
        loadedProducts.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(loadedProducts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Salva o carrinho no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem("@santo-cacau:cart", JSON.stringify(cart));
  }, [cart]);

  const formatPrice = (price: number) => {
    return price.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const updateCart = (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);

      // Validação de Estoque
      if (next > product.stock_quantity) {
        alert(
          `Desculpe, temos apenas ${product.stock_quantity} unidades de ${product.name} no momento.`,
        );
        return prev;
      }

      if (next === 0) {
        const nextCart = { ...prev };
        delete nextCart[productId];
        return nextCart;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleSendWhatsApp = () => {
    if (!customerName) {
      alert("Por favor, informe seu nome antes de finalizar o pedido!");
      return;
    }
    if (deliveryType === "entrega" && !address) {
      alert("Por favor, informe o endereço de entrega completo!");
      return;
    }
    if (Object.keys(cart).length === 0) {
      alert("Seu carrinho está vazio!");
      return;
    }

    let text = `Olá, Santo Cacau! Gostaria de fazer um pedido.\n\n`;
    text += `*Cliente:* ${customerName}\n\n`;
    text += `*Pedido:*\n`;

    let total = 0;
    Object.entries(cart).forEach(([id, quantity]) => {
      const product = products.find((p) => p.id === id);
      if (product) {
        text += `• ${quantity}x ${product.name} (${formatPrice(product.price)})\n`;
        total += product.price * quantity;
      }
    });

    text += `\n*Total:* ${formatPrice(total)}\n`;
    text += `\n*Modalidade:* ${deliveryType === "entrega" ? "Entrega 🛵" : "Retirada 🏪"}\n`;

    if (deliveryType === "entrega") {
      text += `*Endereço:* ${address}\n`;
    }

    const phone = "5517997541174";
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, "_blank");

    setCart({});
    setCustomerName("");
    setAddress("");
    setOrderSuccess(true);
  };

  const filteredProducts =
    activeCategory === "Todos"
      ? products
      : products.filter((p) => p.category === activeCategory);

  const cartTotal = useMemo(() => {
    let total = 0;
    Object.entries(cart).forEach(([id, qty]) => {
      const p = products.find((prod) => prod.id === id);
      if (p) total += p.price * qty;
    });
    return total;
  }, [cart, products]);

  return (
    <div className="w-full min-h-screen md:h-screen bg-[#F5F2EB] flex flex-col md:overflow-hidden font-sans text-[#2A1610]">
      {/* Header Minimalista Premium */}
      <header className="h-24 bg-transparent flex items-center justify-between px-6 md:px-12 shrink-0 pt-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full shadow-sm">
            <img
              src="/logo santo cacau.png"
              alt="Logo Santo Cacau"
              className="h-14 w-14 object-contain rounded-full"
            />
          </div>
          <div className="hidden sm:flex flex-col">
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#2A1610] tracking-tight">
              Santo Cacau
            </h1>
            <p className="text-[10px] md:text-xs uppercase tracking-[0.25em] font-medium text-[#B58E38]">
              Experiência Única
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row md:overflow-hidden p-4 md:p-8 md:pt-4 gap-8 max-w-[1400px] mx-auto w-full">
        {/* Product Listing */}
        <section className="flex-[2] flex flex-col gap-8 md:overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
            <div>
              <h2 className="text-4xl font-serif text-[#2A1610] italic">
                Menu
              </h2>
              <p className="text-[#2A1610]/60 mt-1 text-sm">
                Sinta o toque aveludado de cada sabor.
              </p>
            </div>

            <div className="flex overflow-x-auto gap-6 pb-2 md:pb-0 scrollbar-hide border-b border-[#B58E38]/20">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`pb-3 text-sm font-semibold whitespace-nowrap transition-all duration-300 relative ${activeCategory === cat ? "text-[#B58E38]" : "text-[#2A1610]/50 hover:text-[#2A1610]"}`}
                >
                  {cat}
                  {activeCategory === cat && (
                    <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#B58E38] rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 md:overflow-y-auto scrollbar-hide relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-[#B58E38] font-serif italic text-xl">
                Carregando delícias...
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-6 md:pb-20">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.stock_quantity <= 0;
                  return (
                    <div
                      key={product.id}
                      className={`bg-white rounded-[20px] p-5 flex gap-5 border border-transparent shadow-[0_4px_20px_-4px_rgba(42,22,16,0.04)] transition-all group ${isOutOfStock ? "opacity-60 grayscale" : "hover:shadow-[0_8px_30px_-4px_rgba(42,22,16,0.08)] hover:border-[#B58E38]/20"}`}
                    >
                      <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 bg-[#F5F2EB] rounded-full flex items-center justify-center text-3xl shadow-inner relative">
                        {product.emoji}
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <h3 className="font-serif font-bold text-lg text-[#2A1610] group-hover:text-[#B58E38] transition-colors">
                            {product.name}
                          </h3>
                          <p className="text-xs text-[#2A1610]/60 leading-relaxed mt-1">
                            {product.description}
                          </p>
                        </div>

                        <div className="flex justify-between items-center mt-4">
                          <span className="text-[#B58E38] font-bold text-lg">
                            {formatPrice(product.price)}
                          </span>

                          {isOutOfStock ? (
                            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-3 py-1 rounded-full uppercase tracking-wider">
                              Esgotado
                            </span>
                          ) : (
                            <div className="flex items-center bg-[#F5F2EB] rounded-full p-1 border border-[#B58E38]/10">
                              <button
                                onClick={() => updateCart(product.id, -1)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white text-[#2A1610] transition-colors disabled:opacity-30"
                                disabled={!cart[product.id]}
                              >
                                -
                              </button>
                              <span
                                className={`w-6 text-center font-mono text-sm ${cart[product.id] ? "text-[#2A1610] font-bold" : "text-[#2A1610]/40"}`}
                              >
                                {cart[product.id]
                                  ?.toString()
                                  .padStart(2, "0") || "00"}
                              </span>
                              <button
                                onClick={() => updateCart(product.id, 1)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white text-[#2A1610] transition-colors"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full h-32 flex items-center justify-center text-[#2A1610]/40 font-serif italic text-lg">
                    Nenhum doce encontrado nesta categoria.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Sidebar / Cart - Dark Chocolate Theme */}
        <aside className="w-full md:w-[380px] lg:w-[420px] shrink-0 bg-[#2A1610] rounded-[32px] shadow-2xl p-6 md:p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#B58E38] opacity-10 rounded-bl-full pointer-events-none" />

          <div className="flex items-center gap-3 mb-8 shrink-0 relative z-10 border-b border-white/10 pb-6">
            <ShoppingBag className="w-6 h-6 text-[#B58E38]" />
            <h2 className="text-2xl font-serif text-white">Sua Seleção</h2>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 mb-6 scrollbar-hide min-h-[200px] relative z-10">
            {orderSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 text-white animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-[#B58E38]/20 text-[#B58E38] rounded-full flex items-center justify-center mb-2">
                  <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                    <path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.757.459 3.41 1.259 4.85l-1.336 4.88 4.996-1.313c1.408.767 3.013 1.206 4.719 1.206 5.507 0 10.02-4.479 10.02-9.988S17.519 2 12.012 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold mb-2 text-[#B58E38]">
                    Pedido Gerado!
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed max-w-[250px] mx-auto">
                    Seu carrinho foi limpo. Finalize os detalhes diretamente no
                    WhatsApp.
                  </p>
                </div>
                <button
                  onClick={() => setOrderSuccess(false)}
                  className="mt-6 px-8 py-3 bg-[#B58E38] rounded-full text-sm font-bold text-white shadow-sm hover:bg-[#9E7A2E] transition-all"
                >
                  Fazer Novo Pedido
                </button>
              </div>
            ) : Object.entries(cart).length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-white/30 text-sm font-serif italic">
                Sua sacola está vazia.
                <br />
                Adicione as nossas delícias!
              </div>
            ) : (
              Object.entries(cart).map(([id, quantity]) => {
                const product = products.find((p) => p.id === id);
                if (!product) return null;
                return (
                  <div
                    key={id}
                    className="flex justify-between items-center text-sm pb-3 border-b border-white/5"
                  >
                    <span className="text-white/90 flex-1 pr-2 truncate">
                      <span className="font-mono text-[#B58E38] font-bold mr-2">
                        {quantity}x
                      </span>
                      {product.name}
                    </span>
                    <span className="font-bold text-[#B58E38] whitespace-nowrap">
                      {formatPrice(product.price * quantity)}
                    </span>
                  </div>
                );
              })
            )}

            {!orderSuccess && (
              <div className="mt-auto pt-6 flex flex-col gap-4 shrink-0">
                <input
                  type="text"
                  placeholder="Nome do Cliente"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-sm focus:border-[#B58E38] outline-none text-white placeholder:text-white/30 transition-all"
                />

                <div className="flex gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5">
                  <button
                    onClick={() => setDeliveryType("entrega")}
                    className={`flex-1 py-2.5 text-[10px] md:text-xs uppercase font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${deliveryType === "entrega" ? "bg-[#B58E38] text-white shadow-md" : "text-white/50 hover:text-white"}`}
                  >
                    <MapPin className="w-3 h-3 md:w-4 md:h-4" /> Entrega
                  </button>
                  <button
                    onClick={() => setDeliveryType("retirada")}
                    className={`flex-1 py-2.5 text-[10px] md:text-xs uppercase font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${deliveryType === "retirada" ? "bg-[#B58E38] text-white shadow-md" : "text-white/50 hover:text-white"}`}
                  >
                    <Store className="w-3 h-3 md:w-4 md:h-4" /> Retirada
                  </button>
                </div>

                {deliveryType === "entrega" ? (
                  <textarea
                    placeholder="Endereço de Entrega (Rua, Número, Bairro, Complemento)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-sm h-24 resize-none focus:border-[#B58E38] outline-none text-white placeholder:text-white/30 transition-all"
                  />
                ) : (
                  <div className="bg-[#B58E38]/10 rounded-xl p-5 text-xs text-white/80 text-center border border-[#B58E38]/20">
                    Retirada na nossa loja:
                    <br />
                    <strong className="font-semibold block mt-2 text-[#B58E38] text-sm leading-relaxed">
                      Rua Rosa Rita dos Santos Sabadotto, 3828
                      <br />
                      Monte Verde - Votuporanga SP
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {!orderSuccess && (
            <div className="pt-4 shrink-0 relative z-10">
              <div className="flex justify-between items-end mb-6 bg-white/5 p-5 rounded-xl border border-white/5">
                <span className="text-white/60 uppercase text-xs font-bold tracking-widest mb-1">
                  Total
                </span>
                <span className="text-3xl font-serif font-bold text-[#B58E38] tracking-tight">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <button
                onClick={handleSendWhatsApp}
                disabled={Object.keys(cart).length === 0}
                className="w-full bg-[#B58E38] text-white py-4.5 rounded-xl font-bold text-sm shadow-lg hover:bg-[#9E7A2E] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.757.459 3.41 1.259 4.85l-1.336 4.88 4.996-1.313c1.408.767 3.013 1.206 4.719 1.206 5.507 0 10.02-4.479 10.02-9.988S17.519 2 12.012 2z" />
                </svg>
                Finalizar no WhatsApp
              </button>
            </div>
          )}
        </aside>
      </main>

      <footer className="py-6 flex items-center justify-center shrink-0">
        <p className="text-[10px] text-[#2A1610]/40 font-semibold tracking-[0.2em] uppercase">
          Santo Cacau &bull; O Sabor da Intensidade &bull; (17) 99754-1174
        </p>
      </footer>
    </div>
  );
}
