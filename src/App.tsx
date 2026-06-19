import { useState, useMemo, useEffect } from "react";
import {
  MapPin,
  Store,
  ShoppingBag,
  X,
  ChevronDown,
  CalendarDays,
  QrCode,
  CreditCard,
  Banknote
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
// CONFIGURAÇÃO DO FIREBASE
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

  // Controle do Modal do Carrinho
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [cart, setCart] = useState<Record<string, number>>(() => {
    const savedCart = localStorage.getItem("@santo-cacau:cart");
    if (savedCart) {
      try {
        return JSON.parse(savedCart);
      } catch (e) {}
    }
    return {};
  });

  const [activeCategory, setActiveCategory] = useState("Brigadeiros");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("entrega");
  const [address, setAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
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
    return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  // LÓGICA DE MÁSCARA DO WHATSAPP (AUTO FORMATADOR)
  // ==================================================
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 11) value = value.slice(0, 11);
    
    let formatted = value;
    if (value.length > 2) {
      formatted = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 7) {
      formatted = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    }
    setCustomerPhone(formatted);
  };

  // ==================================================
  // LÓGICA DE DATAS
  // ==================================================
  const totalBrigadeiros = useMemo(() => {
    let count = 0;
    Object.entries(cart).forEach(([id, quantity]) => {
      const p = products.find((prod) => prod.id === id);
      if (p && p.category.toLowerCase().includes("brigadeiro")) {
        count += quantity;
      }
    });
    return count;
  }, [cart, products]);

  const isLargeOrder = totalBrigadeiros > 50;

  const minDeliveryDate = useMemo(() => {
    const d = new Date();
    if (isLargeOrder) {
      d.setDate(d.getDate() + 7); // Mínimo de 1 semana se for grande
    }
    // Retorna a data de hoje por padrão
    return d.toISOString().split("T")[0];
  }, [isLargeOrder]);

  // Sempre que a data mínima mudar, atualiza o calendário do usuário
  useEffect(() => {
    setDeliveryDate(minDeliveryDate);
  }, [minDeliveryDate]);

  // ==================================================
  // FINALIZAÇÃO DE PEDIDO
  // ==================================================
  const handleFinalizeOrder = async () => {
    const rawPhone = customerPhone.replace(/\D/g, "");

    if (!customerName) {
      alert("Por favor, informe seu nome antes de finalizar o pedido!");
      return;
    }
    if (!rawPhone || rawPhone.length < 10) {
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
        isLargeOrder
          ? "Para encomendas acima de 50 brigadeiros, o prazo mínimo é de 1 semana."
          : "Data selecionada é inválida."
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
      customerPhone: rawPhone, // Salva os números limpos no banco
      deliveryType,
      paymentMethod,
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
    <div className="w-full min-h-screen bg-[#F5F2EB] flex flex-col font-sans text-[#2A1610] relative">
      
      {/* BACKGROUND DO MODAL */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsCartOpen(false)}
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

      {/* ÁREA PRINCIPAL DA LOJA */}
      <main className="flex-1 flex flex-col p-4 md:p-8 md:pt-4 gap-8 max-w-[1400px] mx-auto w-full">
        <section className="w-full flex flex-col gap-6 md:gap-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
            <div>
              <h2 className="text-4xl font-serif text-[#2A1610] italic">
                Menu
              </h2>
              <p className="text-[#2A1610]/60 mt-1 text-sm">
                Sinta o toque aveludado de cada sabor.
              </p>
            </div>

            <div className="flex items-center gap-6 w-full md:w-auto">
              {/* SELECT MOBILE */}
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

              {/* BARRA DE CATEGORIAS DESKTOP */}
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

              {/* NOVO BOTÃO DE SACOLA DESKTOP */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="hidden md:flex items-center gap-3 bg-[#2A1610] text-white px-6 py-3.5 rounded-full font-bold shadow-lg hover:bg-[#1A0D09] transition-all hover:scale-105 shrink-0"
              >
                <ShoppingBag size={20} className="text-[#B58E38]" />
                <span className="uppercase tracking-widest text-xs">Sacola</span>
                {cartItemsCount > 0 && (
                  <span className="bg-[#B58E38] text-white text-[11px] w-6 h-6 flex items-center justify-center rounded-full shadow-inner">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center text-[#B58E38] font-serif italic text-xl h-64">
                Carregando delícias...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-32 md:pb-20">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-[20px] p-5 flex gap-5 border border-transparent shadow-[0_4px_20px_-4px_rgba(42,22,16,0.04)] transition-all group hover:shadow-[0_8px_30px_-4px_rgba(42,22,16,0.08)] hover:border-[#B58E38]/20"
                  >
                    <div className="w-20 h-20 shrink-0 bg-[#F5F2EB] rounded-full flex items-center justify-center shadow-inner relative overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">{product.emoji || "🍫"}</span>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h3 className="font-serif font-bold text-lg text-[#2A1610] group-hover:text-[#B58E38] transition-colors leading-tight mb-1">
                          {product.name}
                        </h3>
                        <p className="text-[11px] text-[#2A1610]/60 leading-relaxed line-clamp-2">
                          {product.description}
                        </p>
                      </div>
                      <div className="flex justify-between items-center mt-3">
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
                          <span className={`w-6 text-center font-mono text-sm ${cart[product.id] ? "text-[#2A1610] font-bold" : "text-[#2A1610]/40"}`}>
                            {cart[product.id]?.toString().padStart(2, "0") || "00"}
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

        {/* ================================================== */}
        {/* MODAL DA SACOLA (RESPONSIVO: BOTTOM SHEET -> MODAL) */}
        {/* ================================================== */}
        <aside
          className={`
          fixed z-50 flex flex-col overflow-hidden bg-[#2A1610] shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          
          /* Estilo Celular (Aparece de baixo) */
          inset-x-0 bottom-0 h-[85vh] rounded-t-[32px] p-6
          
          /* Estilo Desktop (Modal Centralizado) */
          md:inset-auto md:top-1/2 md:left-1/2 md:h-auto md:max-h-[90vh] md:w-[800px] md:rounded-[32px] md:p-8
          
          ${isCartOpen 
            ? "translate-y-0 md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-100 md:scale-100 md:pointer-events-auto" 
            : "translate-y-full md:-translate-x-1/2 md:-translate-y-1/2 md:opacity-0 md:scale-95 md:pointer-events-none"
          }
        `}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#B58E38] opacity-10 rounded-bl-full pointer-events-none" />

          <div className="flex justify-between items-center mb-6 shrink-0 relative z-10 border-b border-white/10 pb-6">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-[#B58E38]" />
              <h2 className="text-2xl font-serif text-white">Sua Seleção</h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="text-white/50 hover:text-white p-2 transition-colors rounded-full hover:bg-white/5"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 mb-4 scrollbar-hide relative z-10">
            {orderSuccess ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 text-white animate-in fade-in duration-500 pb-4">
                <div className="w-20 h-20 bg-[#B58E38]/20 text-[#B58E38] rounded-full flex items-center justify-center mb-2">
                  <svg className="w-10 h-10 fill-current" viewBox="0 0 24 24">
                    <path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.757.459 3.41 1.259 4.85l-1.336 4.88 4.996-1.313c1.408.767 3.013 1.206 4.719 1.206 5.507 0 10.02-4.479 10.02-9.988S17.519 2 12.012 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif text-3xl font-bold mb-3 text-[#B58E38]">
                    Pedido Registrado!
                  </h3>

                  {paymentMethod === "PIX" ? (
                    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl mb-6 w-full max-w-[320px] mx-auto text-center">
                      <p className="text-xs text-white/80 mb-2 uppercase tracking-wider font-bold">
                        Nossa Chave PIX (Celular)
                      </p>
                      <p className="font-mono text-2xl text-[#B58E38] font-bold select-all mb-3 bg-[#B58E38]/10 py-2 rounded-xl border border-[#B58E38]/20">
                        17997541174
                      </p>
                      <p className="text-xs text-white/60 leading-relaxed">
                        Faça o pagamento e envie o comprovante no nosso WhatsApp para iniciarmos a produção.
                      </p>
                    </div>
                  ) : (
                    <p className="text-base text-white/70 leading-relaxed max-w-[300px] mx-auto mb-6">
                      Sua encomenda já está no nosso sistema. O pagamento será feito na{" "}
                      <span className="text-white font-bold">{deliveryType === "entrega" ? "entrega" : "retirada"}</span>.
                    </p>
                  )}
                </div>

                <div className="w-full max-w-[320px] flex flex-col gap-3">
                  {/* BOTÃO DO WHATSAPP DA VERSÃO VENCEDORA */}
                  <a
                    href="https://wa.me/5517997541174"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (createdOrderId) {
                        updateDoc(doc(db, "orders", createdOrderId), {
                          whatsappEnviado: "solicitado"
                        }).catch(err => console.error("Erro interno do Firebase:", err));
                      }
                      setTimeout(() => {
                        setCart({});
                        setCustomerName("");
                        setCustomerPhone("");
                        setAddress("");
                        setDeliveryDate("");
                        setPaymentMethod("PIX");
                        setCreatedOrderId(null);
                        setOrderSuccess(false);
                        setIsCartOpen(false);
                      }, 500);
                    }}
                    className="w-full bg-[#25D366] text-white py-4 rounded-xl font-bold text-sm shadow-lg hover:bg-[#20bd5a] transition-all flex items-center justify-center gap-2 cursor-pointer text-center inline-flex"
                  >
                    {paymentMethod === "PIX" ? "Enviar comprovante" : "Acompanhar no WhatsApp"}
                  </a>

                  <button
                    onClick={() => {
                      setCart({});
                      setCustomerName("");
                      setCustomerPhone("");
                      setAddress("");
                      setDeliveryDate("");
                      setPaymentMethod("PIX");
                      setCreatedOrderId(null);
                      setOrderSuccess(false);
                      setIsCartOpen(false);
                    }}
                    className="w-full bg-white/5 text-white/70 py-4 rounded-xl font-bold text-sm hover:bg-white/10 transition-all"
                  >
                    Voltar ao Menu
                  </button>
                </div>
              </div>
            ) : (
              <div className="md:grid md:grid-cols-2 md:gap-8 h-full">
                {/* LADO ESQUERDO DA TELA GRANDE: OS ITENS */}
                <div className="flex flex-col gap-4 mb-8 md:mb-0">
                  <h3 className="hidden md:flex text-[#B58E38] font-bold text-xs uppercase tracking-widest mb-2 border-b border-white/10 pb-2">
                    Itens na Sacola
                  </h3>
                  
                  {Object.entries(cart).length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-center text-white/30 text-sm font-serif italic py-10 md:py-20">
                      A sua sacola está vazia.<br />Adicione as nossas delícias!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(cart).map(([id, quantity]) => {
                        const product = products.find((p) => p.id === id);
                        if (!product) return null;
                        return (
                          <div key={id} className="flex justify-between items-center text-sm pb-3 border-b border-white/5">
                            <span className="text-white/90 flex-1 pr-2 truncate">
                              <span className="font-mono text-[#B58E38] font-bold mr-3 bg-[#B58E38]/10 px-2 py-1 rounded-md">
                                {quantity}x
                              </span>
                              {product.name}
                            </span>
                            <span className="font-bold text-[#B58E38] whitespace-nowrap">
                              {formatPrice(product.price * quantity)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* LADO DIREITO DA TELA GRANDE: O FORMULÁRIO */}
                <div className="flex flex-col gap-4">
                  <h3 className="hidden md:flex text-[#B58E38] font-bold text-xs uppercase tracking-widest mb-2 border-b border-white/10 pb-2">
                    Detalhes do Pedido
                  </h3>

                  <input
                    type="text"
                    placeholder="Nome do Cliente"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-sm focus:border-[#B58E38] outline-none text-white placeholder:text-white/40 transition-all"
                  />

                  {/* INPUT COM MÁSCARA AUTOMÁTICA */}
                  <input
                    type="tel"
                    placeholder="WhatsApp (Ex: 17 99999-9999)"
                    value={customerPhone}
                    onChange={handlePhoneChange}
                    maxLength={15}
                    className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-sm focus:border-[#B58E38] outline-none text-white placeholder:text-white/40 transition-all"
                  />

                  {/* CARDS VISUAIS DE PAGAMENTO */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-bold text-[#B58E38] tracking-widest text-center md:text-left">
                      Forma de Pagamento
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "PIX", label: "PIX", Icon: QrCode },
                        { id: "Cartão de Crédito/Débito", label: "Cartão", Icon: CreditCard },
                        { id: "Dinheiro", label: "Dinheiro", Icon: Banknote },
                      ].map((method) => (
                        <button
                          key={method.id}
                          onClick={() => setPaymentMethod(method.id)}
                          className={`py-3 px-1 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                            paymentMethod === method.id
                              ? "bg-[#B58E38] border-[#B58E38] text-white shadow-md scale-[1.02]"
                              : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"
                          }`}
                        >
                          <method.Icon size={18} />
                          <span className="font-bold text-[9px] md:text-[10px] uppercase tracking-wider text-center leading-tight">
                            {method.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
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
                    {isLargeOrder && (
                      <span className="text-[10px] text-yellow-500/90 leading-tight mt-1 border-t border-white/10 pt-2">
                        ⚠️ Acima de 50 brigadeiros, o prazo mínimo de entrega é de 1 semana.
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <button
                      onClick={() => setDeliveryType("entrega")}
                      className={`flex-1 py-2.5 text-[10px] md:text-xs uppercase font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${deliveryType === "entrega" ? "bg-[#B58E38] text-white shadow-md" : "text-white/50 hover:text-white"}`}
                    >
                      <MapPin className="w-4 h-4" /> Entrega
                    </button>
                    <button
                      onClick={() => setDeliveryType("retirada")}
                      className={`flex-1 py-2.5 text-[10px] md:text-xs uppercase font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${deliveryType === "retirada" ? "bg-[#B58E38] text-white shadow-md" : "text-white/50 hover:text-white"}`}
                    >
                      <Store className="w-4 h-4" /> Retirada
                    </button>
                  </div>

                  {deliveryType === "entrega" ? (
                    <textarea
                      placeholder="Endereço (Rua, Número, Bairro...)"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-sm h-16 resize-none focus:border-[#B58E38] outline-none text-white placeholder:text-white/40 transition-all"
                    />
                  ) : (
                    <div className="bg-[#B58E38]/10 rounded-xl p-4 text-xs text-white/80 text-center border border-[#B58E38]/20">
                      Retirada na loja:
                      <br />
                      <strong className="font-semibold block mt-1.5 text-[#B58E38] text-sm leading-relaxed">
                        Rua Rosa Rita dos Santos Sabadotto, 3828
                        <br />
                        Monte Verde - Votuporanga SP
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {!orderSuccess && (
            <div className="pt-4 shrink-0 relative z-10 border-t border-white/10 mt-auto">
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

        {/* BOTÃO FLUTUANTE MOBILE (Esconde no Desktop) */}
        {!isCartOpen && (
          <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#F5F2EB] via-[#F5F2EB] to-transparent z-30 md:hidden pointer-events-none">
            <button
              onClick={() => setIsCartOpen(true)}
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

      <footer className="py-6 flex items-center justify-center shrink-0 hidden md:flex mt-auto">
        <p className="text-[10px] text-[#2A1610]/40 font-semibold tracking-[0.2em] uppercase">
          Santo Cacau &bull; O Sabor da Intensidade &bull; (17) 99754-1174
        </p>
      </footer>
    </div>
  );
}