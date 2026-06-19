import { useState, useMemo, useEffect } from "react";
import {
  MapPin,
  Store,
  ShoppingBag,
  X,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

// ==========================================
// CONFIGURAÇÃO DO FIREBASE (VIA VARIÁVEIS DE AMBIENTE)
// ==========================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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
  imageUrl?: string;
  emoji?: string;
}

const CATEGORIES = [
  "Todos",
  "Brigadeiros",
  "Bolos",
  "Caixinhas",
  "Caixinhas Temáticas",
  "Combos",
];

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Controle do Modal do Carrinho no Mobile
  const [isCartMobileOpen, setIsCartMobileOpen] = useState(false);

  const [cart, setCart] = useState<Record<string, number>>(() => {
    const savedCart = localStorage.getItem("@santo-cacau:cart");
    if (savedCart) {
      try {
        return JSON.parse(savedCart);
      } catch (e) {}
    }
    return {};
  });

  const [activeCategory, setActiveCategory] = useState("Brigadeiros"); // Categoria Padrão
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState(""); // <-- NOVO ESTADO
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("entrega");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(""); // Novo estado: Data de Entrega
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

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
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const nextCart = { ...prev };
        delete nextCart[productId];
        return nextCart;
      }
      return { ...prev, [productId]: next };
    });
  };

  // ==================================================
  // LÓGICA DE DATAS (CONDIÇÃO PARA MAIS DE 50 BRIGADEIROS)
  // ==================================================
  const totalBrigadeiros = useMemo(() => {
    let count = 0;
    Object.entries(cart).forEach(([id, quantity]) => {
      const p = products.find((prod) => prod.id === id);
      // Conta apenas itens da categoria "Brigadeiros"
      if (p && p.category.toLowerCase().includes("brigadeiro")) {
        count += quantity;
      }
    });
    return count;
  }, [cart, products]);

  const minDeliveryDate = useMemo(() => {
    const d = new Date();
    if (totalBrigadeiros > 50) {
      d.setDate(d.getDate() + 7); // Mínimo de 1 semana
    } else {
      d.setDate(d.getDate() + 1); // Mínimo de 1 dia (amanhã) para encomendas normais
    }
    return d.toISOString().split("T")[0];
  }, [totalBrigadeiros]);

  const handleFinalizeOrder = async () => {
    if (!customerName) {
      alert("Por favor, informe seu nome antes de finalizar o pedido!");
      return;
    }
    if (!customerPhone || customerPhone.length < 10) {
      alert("Por favor, informe um número de WhatsApp válido!");
      return;
    }
    if (deliveryType === "entrega" && !address) {
      alert("Por favor, informe o endereço de entrega completo!");
      return;
    }
    if (!deliveryDate) {
      alert("Por favor, selecione a data desejada para a encomenda!");
      return;
    }
    if (Object.keys(cart).length === 0) {
      alert("A sua sacola está vazia!");
      return;
    }

    const selectedDateObj = new Date(deliveryDate + "T00:00:00");
    const minDateObj = new Date(minDeliveryDate + "T00:00:00");
    if (selectedDateObj < minDateObj) {
      alert(
        totalBrigadeiros > 50
          ? "Para encomendas acima de 50 brigadeiros, o prazo mínimo é de 1 semana."
          : "Data selecionada é inválida.",
      );
      return;
    }

    const [year, month, day] = deliveryDate.split("-");
    const formattedDate = `${day}/${month}/${year}`;

    const orderItems = Object.entries(cart).map(([id, quantity]) => {
      const p = products.find((prod) => prod.id === id);
      return { id, name: p?.name || "Produto", price: p?.price || 0, quantity };
    });

    let total = 0;
    orderItems.forEach((item) => {
      total += item.price * item.quantity;
    });

    const orderData = {
      customerName,
      customerPhone,
      deliveryType,
      paymentMethod, // <-- Informação do pagamento indo para o banco
      address: deliveryType === "entrega" ? address : "Retirada na loja",
      deliveryDate: formattedDate,
      total: total,
      status: "Pendente",
      whatsappEnviado: "nao_solicitado",
      createdAt: Date.now(),
      items: orderItems,
    };

    try {
      const docRef = await addDoc(collection(db, "orders"), orderData);
      setCreatedOrderId(docRef.id);
      // Aqui nós NÃO abrimos o wa.me. Apenas mostramos a tela de sucesso!
      setOrderSuccess(true);
    } catch (error) {
      console.error(error);
      alert("Houve um erro ao registar a sua encomenda. Tente novamente.");
    }
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

  const cartItemsCount = useMemo(() => {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  }, [cart]);

  return (
    <div className="w-full min-h-screen md:h-screen bg-[#F5F2EB] flex flex-col md:overflow-hidden font-sans text-[#2A1610] relative">
      {isCartMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsCartMobileOpen(false)}
        />
      )}

      <header className="h-24 bg-transparent flex items-center px-4 md:px-8 shrink-0 pt-4 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full shadow-sm">
            <img
              src="/logo santo cacau.png"
              alt="Logo Santo Cacau"
              className="h-14 w-14 object-contain rounded-full"
            />
          </div>
          <div className="flex flex-col">
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
        <section className="flex-[2] flex flex-col gap-6 md:gap-8 md:overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
            <div>
              <h2 className="text-4xl font-serif text-[#2A1610] italic">
                Menu
              </h2>
              <p className="text-[#2A1610]/60 mt-1 text-sm">
                Sinta o toque aveludado de cada sabor.
              </p>
            </div>

            <div className="w-full md:hidden relative mt-2">
              <select
                value={activeCategory}
                onChange={(e) => setActiveCategory(e.target.value)}
                className="w-full appearance-none bg-white border border-[#B58E38]/20 text-[#2A1610] py-3.5 px-5 rounded-2xl font-bold shadow-sm focus:outline-none focus:border-[#B58E38] transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-5 top-1/2 -translate-y-1/2 text-[#B58E38] pointer-events-none"
                size={20}
              />
            </div>

            <div className="hidden md:flex overflow-x-auto gap-6 pb-2 md:pb-0 scrollbar-hide border-b border-[#B58E38]/20">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-32 md:pb-20">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-[20px] p-5 flex gap-5 border border-transparent shadow-[0_4px_20px_-4px_rgba(42,22,16,0.04)] transition-all group hover:shadow-[0_8px_30px_-4px_rgba(42,22,16,0.08)] hover:border-[#B58E38]/20"
                  >
                    <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 bg-[#F5F2EB] rounded-full flex items-center justify-center shadow-inner relative overflow-hidden">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">
                          {product.emoji || "🍫"}
                        </span>
                      )}
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
                            {cart[product.id]?.toString().padStart(2, "0") ||
                              "00"}
                          </span>
                          <button
                            onClick={() => updateCart(product.id, 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white text-[#2A1610] transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full h-32 flex items-center justify-center text-[#2A1610]/40 font-serif italic text-lg">
                    Nenhum doce encontrado nesta categoria.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <aside
          className={`
          fixed inset-x-0 bottom-0 z-50 h-[85vh] transition-transform duration-300 ease-in-out
          md:relative md:inset-auto md:h-auto md:w-[380px] lg:w-[420px] shrink-0 md:z-10
          ${isCartMobileOpen ? "translate-y-0" : "translate-y-full"} md:translate-y-0
          bg-[#2A1610] rounded-t-[32px] md:rounded-[32px] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] md:shadow-2xl p-6 md:p-8 flex flex-col overflow-hidden
        `}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#B58E38] opacity-10 rounded-bl-full pointer-events-none" />

          <div className="flex justify-between items-center mb-6 shrink-0 relative z-10 border-b border-white/10 pb-6">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-[#B58E38]" />
              <h2 className="text-2xl font-serif text-white">Sua Seleção</h2>
            </div>
            <button
              onClick={() => setIsCartMobileOpen(false)}
              className="md:hidden text-white/50 hover:text-white p-2"
            >
              <X size={24} />
            </button>
          </div>

          {/* ÁREA DO MEIO: ITENS DO CARRINHO E TELA DE SUCESSO */}
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 mb-4 scrollbar-hide min-h-[200px] relative z-10">
            {orderSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 text-white animate-in fade-in duration-500 pb-4">
                <div className="w-16 h-16 bg-[#B58E38]/20 text-[#B58E38] rounded-full flex items-center justify-center mb-2">
                  <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                    <path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.757.459 3.41 1.259 4.85l-1.336 4.88 4.996-1.313c1.408.767 3.013 1.206 4.719 1.206 5.507 0 10.02-4.479 10.02-9.988S17.519 2 12.012 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif text-2xl font-bold mb-2 text-[#B58E38]">
                    Pedido Registrado!
                  </h3>

                  {paymentMethod === "PIX" ? (
                    <div className="bg-white/5 border border-white/10 p-4 rounded-xl mb-4 w-full max-w-[280px] mx-auto text-center">
                      <p className="text-xs text-white/80 mb-2 uppercase tracking-wider font-bold">
                        Nossa Chave PIX (Celular)
                      </p>
                      <p className="font-mono text-2xl text-[#B58E38] font-bold select-all mb-2">
                        17997541174
                      </p>
                      <p className="text-[11px] text-white/50 leading-relaxed">
                        Sua encomenda já está no nosso sistema. Faça o pagamento
                        e envie o comprovante no nosso WhatsApp para iniciarmos
                        a produção.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-white/70 leading-relaxed max-w-[250px] mx-auto mb-4">
                      Sua encomenda já está no nosso sistema. O pagamento será
                      feito na{" "}
                      {deliveryType === "entrega" ? "entrega" : "retirada"}.
                    </p>
                  )}
                </div>

                <div className="w-full flex flex-col gap-3 mt-auto">
                  {/* BOTÃO VERDE DO WHATSAPP */}
                  <button
                    onClick={async () => {
                      try {
                        // 1. OBRIGA o site a avisar o Firebase e esperar a resposta "OK"
                        if (createdOrderId) {
                          await updateDoc(doc(db, "orders", createdOrderId), {
                            whatsappEnviado: "solicitado",
                          });
                        }

                        // 2. Limpa o carrinho e a tela de sucesso
                        setCart({});
                        setCustomerName("");
                        setCustomerPhone("");
                        setAddress("");
                        setDeliveryDate("");
                        setPaymentMethod("PIX");
                        setCreatedOrderId(null);
                        setOrderSuccess(false);
                        setIsCartMobileOpen(false);

                        // 3. Redireciona na MESMA ABA (Isso nunca é bloqueado pelo celular/navegador)
                        window.location.href = "https://wa.me/5517997541174";
                      } catch (error) {
                        console.error("Erro ao avisar o bot:", error);
                        alert(
                          "Não foi possível redirecionar. Tente novamente.",
                        );
                      }
                    }}
                    className="w-full bg-[#25D366] text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-[#20bd5a] transition-all flex items-center justify-center gap-2"
                  >
                    {paymentMethod === "PIX"
                      ? "Enviar comprovante"
                      : "Acompanhar no WhatsApp"}
                  </button>

                  <button
                    onClick={() => {
                      setCart({});
                      setCustomerName("");
                      setCustomerPhone("");
                      setAddress("");
                      setDeliveryDate("");
                      setPaymentMethod("PIX");
                      setCreatedOrderId(null); // <-- Limpa o ID
                      setOrderSuccess(false);
                      setIsCartMobileOpen(false);
                    }}
                    className="w-full bg-white/5 text-white/70 py-4 rounded-xl font-bold text-sm hover:bg-white/10 transition-all"
                  >
                    Voltar ao Menu
                  </button>
                </div>
              </div>
            ) : Object.entries(cart).length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-white/30 text-sm font-serif italic">
                A sua sacola está vazia.
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
              <div className="mt-auto pt-4 flex flex-col gap-3 shrink-0">
                <input
                  type="text"
                  placeholder="Nome do Cliente"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#B58E38] outline-none text-white placeholder:text-white/30 transition-all"
                />

                <input
                  type="tel"
                  placeholder="Seu WhatsApp (Ex: 17999999999)"
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(e.target.value.replace(/\D/g, ""))
                  }
                  className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:border-[#B58E38] outline-none text-white placeholder:text-white/30 transition-all"
                />

                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-[#B58E38] tracking-widest">
                    Forma de Pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-transparent text-sm focus:outline-none text-white transition-all [&>option]:text-black cursor-pointer"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito/Débito">
                      Cartão (Na entrega/retirada)
                    </option>
                    <option value="Dinheiro">Dinheiro vivo</option>
                  </select>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-[#B58E38] tracking-widest flex items-center gap-1.5">
                    <CalendarDays size={12} /> Data Desejada
                  </label>
                  <input
                    type="date"
                    min={minDeliveryDate}
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-transparent text-sm focus:outline-none text-white transition-all [&::-webkit-calendar-picker-indicator]:invert cursor-pointer"
                  />
                  {totalBrigadeiros > 50 && (
                    <span className="text-[10px] text-yellow-500/90 leading-tight mt-1 border-t border-white/10 pt-1.5">
                      ⚠️ Acima de 50 brigadeiros, o prazo mínimo de entrega é 1
                      semana.
                    </span>
                  )}
                </div>

                <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setDeliveryType("entrega")}
                    className={`flex-1 py-2 text-[10px] md:text-xs uppercase font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${deliveryType === "entrega" ? "bg-[#B58E38] text-white shadow-md" : "text-white/50 hover:text-white"}`}
                  >
                    <MapPin className="w-3 h-3 md:w-4 md:h-4" /> Entrega
                  </button>
                  <button
                    onClick={() => setDeliveryType("retirada")}
                    className={`flex-1 py-2 text-[10px] md:text-xs uppercase font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${deliveryType === "retirada" ? "bg-[#B58E38] text-white shadow-md" : "text-white/50 hover:text-white"}`}
                  >
                    <Store className="w-3 h-3 md:w-4 md:h-4" /> Retirada
                  </button>
                </div>

                {deliveryType === "entrega" ? (
                  <textarea
                    placeholder="Endereço (Rua, Número, Bairro...)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm h-16 resize-none focus:border-[#B58E38] outline-none text-white placeholder:text-white/30 transition-all"
                  />
                ) : (
                  <div className="bg-[#B58E38]/10 rounded-xl p-3 text-xs text-white/80 text-center border border-[#B58E38]/20">
                    Retirada na loja:
                    <br />
                    <strong className="font-semibold block mt-1 text-[#B58E38] text-sm leading-relaxed">
                      Rua Rosa Rita dos Santos Sabadotto, 3828
                      <br />
                      Monte Verde - Votuporanga SP
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RODAPÉ DO CARRINHO (BOTÃO DE FINALIZAR) */}
          {!orderSuccess && (
            <div className="pt-4 shrink-0 relative z-10 border-t border-white/10">
              <div className="flex justify-between items-end mb-4">
                <span className="text-white/60 uppercase text-xs font-bold tracking-widest">
                  Total
                </span>
                <span className="text-3xl font-serif font-bold text-[#B58E38] tracking-tight">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <button
                onClick={handleFinalizeOrder}
                disabled={Object.keys(cart).length === 0}
                className="w-full bg-[#B58E38] text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-[#9E7A2E] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.757.459 3.41 1.259 4.85l-1.336 4.88 4.996-1.313c1.408.767 3.013 1.206 4.719 1.206 5.507 0 10.02-4.479 10.02-9.988S17.519 2 12.012 2z" />
                </svg>{" "}
                Finalizar Pedido
              </button>
            </div>
          )}
        </aside>

        {!isCartMobileOpen && (
          <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#F5F2EB] via-[#F5F2EB] to-transparent z-30 md:hidden pointer-events-none">
            <button
              onClick={() => setIsCartMobileOpen(true)}
              className="w-full bg-[#B58E38] text-white p-4 rounded-2xl shadow-[0_8px_30px_-4px_rgba(181,142,56,0.4)] flex justify-between items-center font-bold active:scale-[0.98] transition-all pointer-events-auto"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag size={22} />
                  {cartItemsCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-white text-[#B58E38] text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shadow-sm">
                      {cartItemsCount}
                    </span>
                  )}
                </div>
                <span>Ver Sacola</span>
              </div>
              <span className="text-lg">{formatPrice(cartTotal)}</span>
            </button>
          </div>
        )}
      </main>
      <footer className="py-6 flex items-center justify-center shrink-0 hidden md:flex">
        <p className="text-[10px] text-[#2A1610]/40 font-semibold tracking-[0.2em] uppercase">
          Santo Cacau &bull; O Sabor da Intensidade &bull; (17) 99754-1174
        </p>
      </footer>
    </div>
  );
}
