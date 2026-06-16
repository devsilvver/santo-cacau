import { useState, useMemo } from "react";
import {
  Settings,
  Plus,
  Save,
  MapPin,
  Store,
  Trash2,
  Edit2,
} from "lucide-react";

type DeliveryType = "entrega" | "retirada";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  emoji: string;
}

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Brigadeiro Belga",
    description: "Chocolate 54% cacau com granulados puros.",
    price: 4.5,
    category: "Brigadeiros",
    emoji: "🍫",
  },
  {
    id: "2",
    name: "Coxinha Morango",
    description: "Morango fresco envolto em brigadeiro de ninho.",
    price: 12.0,
    category: "Brigadeiros",
    emoji: "🍓",
  },
  {
    id: "3",
    name: "Bolo de Pote",
    description: "Red Velvet com creme cheese frosting leve.",
    price: 15.0,
    category: "Bolos",
    emoji: "🍰",
  },
  {
    id: "4",
    name: "Combo Degustação",
    description: "6 unidades sortidas para você se apaixonar.",
    price: 24.9,
    category: "Combos",
    emoji: "🎁",
  },
];

const CATEGORIES = ["Todos", "Brigadeiros", "Bolos", "Brownies", "Combos"];

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Todos");

  // Checkout Info
  const [customerName, setCustomerName] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("entrega");
  const [address, setAddress] = useState("");

  // Admin Info
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Success State
  const [orderSuccess, setOrderSuccess] = useState(false);

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

  const handleCreateProduct = () => {
    const newProduct: Product = {
      id: Date.now().toString(),
      name: "Novo Produto",
      description: "Descrição do produto...",
      price: 0,
      category: "Brigadeiros",
      emoji: "🍫",
    };
    setProducts([...products, newProduct]);
    setEditingProduct(newProduct);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm("Tem certeza que deseja apagar este produto?")) {
      setProducts(products.filter((p) => p.id !== id));
      setCart((prev) => {
        const nextCart = { ...prev };
        delete nextCart[id];
        return nextCart;
      });
    }
  };

  const handleSaveEdit = (edited: Product) => {
    setProducts(products.map((p) => (p.id === edited.id ? edited : p)));
    setEditingProduct(null);
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

    let text = `Olá, gostaria de fazer um pedido!\n\n`;
    text += `*Cliente:* ${customerName}\n\n`;
    text += `*Pedido:*\n`;

    let total = 0;
    Object.entries(cart).forEach(([id, quantity]) => {
      const product = products.find((p) => p.id === id);
      if (product) {
        text += `- ${quantity}x ${product.name} (${formatPrice(product.price)})\n`;
        total += product.price * quantity;
      }
    });

    text += `\n*Total:* ${formatPrice(total)}\n`;
    text += `\n*Tipo:* ${deliveryType === "entrega" ? "Entrega 🛵" : "Retirada 🏪"}\n`;

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
    <div className="w-full min-h-screen md:h-screen bg-[#F4F1EA] flex flex-col md:overflow-hidden font-sans text-[#3D200F]">
      {/* Header Minimalista */}
      <header className="h-24 bg-white border-b border-[#B5882D]/20 flex items-center justify-between px-6 md:px-10 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <img 
            src="/logo santo cacau.png" 
            alt="Logo Santo Cacau" 
            className="h-16 w-16 object-contain rounded-full shadow-sm"
          />
          <div className="flex flex-col hidden sm:flex">
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#3D200F] tracking-tight">
              Santo Cacau
            </h1>
            <p className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-medium text-[#B5882D]">
              Menu de Experiências
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 md:gap-4 items-center">
          <button
            onClick={() => setIsAdmin(!isAdmin)}
            className={`border px-3 py-2 md:px-4 md:py-2 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 md:gap-2 ${
              isAdmin 
                ? "bg-[#3D200F] text-white border-[#3D200F] hover:bg-[#2A150A]" 
                : "bg-transparent border-[#B5882D]/50 text-[#B5882D] hover:bg-[#B5882D]/10"
            }`}
          >
            <Settings className="w-3 h-3 md:w-4 md:h-4" />
            {isAdmin ? "Sair" : "Admin"}
          </button>
          {!isAdmin && (
            <div className="hidden md:flex items-center gap-2 bg-[#F4F1EA] px-4 py-2 rounded-full border border-[#B5882D]/20">
              <span className="text-sm font-bold text-[#3D200F]">Aberto</span>
              <div className="w-2 h-2 rounded-full bg-[#B5882D] animate-pulse"></div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row md:overflow-hidden p-4 md:p-6 gap-6 max-w-7xl mx-auto w-full">
        {/* Product Listing */}
        <section className="flex-[2] flex flex-col gap-6 md:overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
            <h2 className="text-2xl font-serif text-[#3D200F]">
              Nosso Cardápio
            </h2>
            <div className="flex overflow-x-auto gap-2 pb-2 md:pb-0 scrollbar-hide">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                    activeCategory === cat
                      ? "bg-[#B5882D] text-white shadow-md"
                      : "bg-white border border-[#B5882D]/20 text-[#3D200F] hover:border-[#B5882D]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 md:overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 md:pb-20">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl p-5 flex gap-4 border border-[#B5882D]/10 shadow-sm relative group hover:shadow-md hover:border-[#B5882D]/30 transition-all"
                >
                  <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 bg-[#F4F1EA] rounded-xl flex items-center justify-center text-3xl">
                    {product.emoji}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-[#3D200F]">
                        {product.name}
                      </h3>
                      <p className="text-xs text-[#3D200F]/60 leading-relaxed mt-1">
                        {product.description}
                      </p>
                    </div>

                    {isAdmin ? (
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-[#B5882D] font-bold text-lg">
                          {formatPrice(product.price)}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="text-[#B5882D] hover:bg-[#F4F1EA] p-1.5 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-end mt-3">
                        <span className="text-[#B5882D] font-bold text-lg">
                          {formatPrice(product.price)}
                        </span>
                        <div className="flex items-center bg-[#F4F1EA] rounded-lg p-1 border border-[#B5882D]/10">
                          <button
                            onClick={() => updateCart(product.id, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white text-[#3D200F] transition-colors disabled:opacity-30"
                            disabled={!cart[product.id]}
                          >
                            -
                          </button>
                          <span
                            className={`w-6 text-center font-mono text-sm ${
                              cart[product.id] ? "text-[#3D200F] font-bold" : "text-[#3D200F]/40"
                            }`}
                          >
                            {cart[product.id]?.toString().padStart(2, "0") || "00"}
                          </span>
                          <button
                            onClick={() => updateCart(product.id, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white text-[#3D200F] transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full h-32 flex items-center justify-center text-[#3D200F]/50 font-serif italic">
                  Nenhum produto encontrado nesta categoria.
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="mt-auto bg-white p-5 rounded-2xl border border-[#B5882D]/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="bg-[#F4F1EA] text-[#B5882D] p-3 rounded-xl">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase text-[#3D200F] tracking-wider">
                    Gerenciamento
                  </p>
                  <p className="text-xs text-[#3D200F]/60 mt-0.5">
                    Adicione, edite e remova produtos do menu.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCreateProduct}
                className="bg-[#3D200F] hover:bg-[#2A150A] text-white px-6 py-3 rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Novo Produto
              </button>
            </div>
          )}
        </section>

        {/* Sidebar / Cart */}
        <aside className="w-full md:w-80 lg:w-96 shrink-0 bg-white rounded-3xl border border-[#B5882D]/10 shadow-lg p-6 md:p-8 flex flex-col">
          <h2 className="text-2xl font-serif text-[#3D200F] mb-6 shrink-0 border-b border-[#B5882D]/20 pb-4">
            Sua Seleção
          </h2>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1 mb-6 scrollbar-hide min-h-[200px]">
            {orderSuccess ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 text-[#3D200F] animate-in fade-in duration-500">
                <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center mb-2">
                  <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                    <path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.757.459 3.41 1.259 4.85l-1.336 4.88 4.996-1.313c1.408.767 3.013 1.206 4.719 1.206 5.507 0 10.02-4.479 10.02-9.988S17.519 2 12.012 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold mb-1">
                    Redirecionando!
                  </h3>
                  <p className="text-sm text-[#3D200F]/70 leading-relaxed">
                    Seu carrinho foi limpo. Acompanhe o pedido pelo WhatsApp.
                  </p>
                </div>
                <button
                  onClick={() => setOrderSuccess(false)}
                  className="mt-4 px-6 py-2 bg-white rounded-xl text-sm font-bold text-[#B5882D] border border-[#B5882D]/30 shadow-sm hover:bg-[#F4F1EA] transition-all"
                >
                  Novo Pedido
                </button>
              </div>
            ) : Object.entries(cart).length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center text-[#3D200F]/40 text-sm font-serif italic">
                Seu carrinho está vazio.
                <br />
                Adicione alguns doces!
              </div>
            ) : (
              Object.entries(cart).map(([id, quantity]) => {
                const product = products.find((p) => p.id === id);
                if (!product) return null;
                return (
                  <div
                    key={id}
                    className="flex justify-between items-center text-sm pb-2"
                  >
                    <span className="text-[#3D200F] flex-1 pr-2 truncate">
                      <span className="font-mono text-[#B5882D] font-semibold mr-2">
                        {quantity}x
                      </span>
                      {product.name}
                    </span>
                    <span className="font-bold text-[#3D200F] whitespace-nowrap">
                      {formatPrice(product.price * quantity)}
                    </span>
                  </div>
                );
              })
            )}

            {!orderSuccess && (
              <div className="mt-auto pt-4 flex flex-col gap-3 shrink-0 border-t border-[#B5882D]/10">
                <input
                  type="text"
                  placeholder="Seu Nome Completo"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-[#F4F1EA] border border-transparent rounded-xl p-3 text-sm focus:border-[#B5882D] focus:bg-white outline-none text-[#3D200F] placeholder:text-[#3D200F]/40 transition-all"
                />
                <div className="flex gap-2 bg-[#F4F1EA] p-1.5 rounded-xl border border-transparent">
                  <button
                    onClick={() => setDeliveryType("entrega")}
                    className={`flex-1 py-2 text-[10px] md:text-xs uppercase font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${
                      deliveryType === "entrega"
                        ? "bg-white text-[#B5882D] shadow-sm"
                        : "text-[#3D200F]/50 hover:text-[#3D200F]"
                    }`}
                  >
                    <MapPin className="w-3 h-3 md:w-4 md:h-4" />
                    Entrega
                  </button>
                  <button
                    onClick={() => setDeliveryType("retirada")}
                    className={`flex-1 py-2 text-[10px] md:text-xs uppercase font-bold rounded-lg transition-all flex items-center justify-center gap-2 shrink-0 ${
                      deliveryType === "retirada"
                        ? "bg-white text-[#B5882D] shadow-sm"
                        : "text-[#3D200F]/50 hover:text-[#3D200F]"
                    }`}
                  >
                    <Store className="w-3 h-3 md:w-4 md:h-4" />
                    Retirada
                  </button>
                </div>
                {deliveryType === "entrega" ? (
                  <textarea
                    placeholder="Endereço de Entrega (Rua, Número, Bairro, Complemento)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="bg-[#F4F1EA] border border-transparent rounded-xl p-3 text-sm h-20 resize-none focus:border-[#B5882D] focus:bg-white outline-none text-[#3D200F] placeholder:text-[#3D200F]/40 transition-all"
                  />
                ) : (
                  <div className="bg-[#F4F1EA] rounded-xl p-4 text-xs text-[#3D200F] text-center border border-[#B5882D]/20">
                    Retirada na nossa loja:
                    <br />
                    <strong className="font-semibold block mt-1 text-[#B5882D]">
                      Rua das Rosas, 123 - Centro
                    </strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {!orderSuccess && (
            <div className="pt-2 shrink-0">
              <div className="flex justify-between items-center mb-6 bg-[#F4F1EA] p-4 rounded-xl">
                <span className="text-[#3D200F] uppercase text-xs font-bold tracking-widest">
                  Total
                </span>
                <span className="text-2xl md:text-3xl font-serif font-bold text-[#B5882D] tracking-tight">
                  {formatPrice(cartTotal)}
                </span>
              </div>
              <button
                onClick={handleSendWhatsApp}
                disabled={Object.keys(cart).length === 0}
                className="w-full bg-[#25D366] text-white py-4 rounded-xl font-bold text-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.988 0 1.757.459 3.41 1.259 4.85l-1.336 4.88 4.996-1.313c1.408.767 3.013 1.206 4.719 1.206 5.507 0 10.02-4.479 10.02-9.988S17.519 2 12.012 2z" />
                </svg>
                Finalizar Pedido
              </button>
            </div>
          )}
        </aside>
      </main>

      <footer className="h-10 md:h-12 bg-white flex items-center justify-center border-t border-[#B5882D]/20 shrink-0">
        <p className="text-[9px] md:text-[10px] text-[#3D200F]/60 font-medium tracking-[0.2em] uppercase">
          Santo Cacau &bull; Menu de Experiências &bull; (17) 99754-1174
        </p>
      </footer>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-[#3D200F]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#B5882D]/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif text-2xl text-[#3D200F]">
                Editar Produto
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-[#3D200F]/50 hover:text-[#3D200F] hover:bg-[#F4F1EA] p-2 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#B5882D] mb-1 tracking-wider">
                  Nome
                </label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      name: e.target.value,
                    })
                  }
                  className="w-full bg-[#F4F1EA] border border-transparent rounded-xl p-3 text-sm focus:border-[#B5882D] focus:bg-white outline-none text-[#3D200F]"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold uppercase text-[#B5882D] mb-1 tracking-wider">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.price || ""}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#F4F1EA] border border-transparent rounded-xl p-3 text-sm focus:border-[#B5882D] focus:bg-white outline-none text-[#3D200F]"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-bold uppercase text-[#B5882D] mb-1 tracking-wider">
                    Emoji
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={editingProduct.emoji}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        emoji: e.target.value,
                      })
                    }
                    className="w-full bg-[#F4F1EA] border border-transparent rounded-xl p-3 text-center text-xl focus:border-[#B5882D] focus:bg-white outline-none text-[#3D200F]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-[#B5882D] mb-1 tracking-wider">
                  Categoria
                </label>
                <select
                  value={editingProduct.category}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      category: e.target.value,
                    })
                  }
                  className="w-full bg-[#F4F1EA] border border-transparent rounded-xl p-3 text-sm focus:border-[#B5882D] focus:bg-white outline-none text-[#3D200F]"
                >
                  {CATEGORIES.filter((c) => c !== "Todos").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-[#B5882D] mb-1 tracking-wider">
                  Descrição
                </label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      description: e.target.value,
                    })
                  }
                  className="w-full bg-[#F4F1EA] border border-transparent rounded-xl p-3 text-sm h-24 resize-none focus:border-[#B5882D] focus:bg-white outline-none text-[#3D200F]"
                />
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setEditingProduct(null)}
                className="flex-1 py-3 bg-[#F4F1EA] text-[#3D200F] rounded-xl font-bold text-sm hover:bg-[#E8E2D5] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveEdit(editingProduct)}
                className="flex-[2] py-3 bg-[#B5882D] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#967022] transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}