import { createContext, useContext, useReducer, useEffect } from "react";

// ── Estado inicial ──────────────────────────────────────────────────────────
const initialState = {
  items: JSON.parse(localStorage.getItem("luma_cart_items") || "[]"),
  isOpen: false,
};

// ── Reducer ─────────────────────────────────────────────────────────────────
function cartReducer(state, action) {
  switch (action.type) {
    case "ADD_ITEM": {
      const exists = state.items.find(
        (i) => i.variant_id === action.payload.variant_id
      );
      if (exists) {
        const updated = state.items.map((i) =>
          i.variant_id === action.payload.variant_id
            ? {
                ...i,
                quantity: Math.min(
                  i.quantity + action.payload.quantity,
                  i.max_stock
                ),
              }
            : i
        );
        return { ...state, items: updated };
      }
      return { ...state, items: [...state.items, action.payload] };
    }

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((i) => i.variant_id !== action.payload),
      };

    case "UPDATE_QUANTITY":
      return {
        ...state,
        items: state.items.map((i) =>
          i.variant_id === action.payload.variant_id
            ? { ...i, quantity: Math.max(1, Math.min(action.payload.quantity, i.max_stock)) }
            : i
        ),
      };

    case "CLEAR":
      return { ...state, items: [] };

    case "OPEN_CART":
      return { ...state, isOpen: true };

    case "CLOSE_CART":
      return { ...state, isOpen: false };

    case "TOGGLE_CART":
      return { ...state, isOpen: !state.isOpen };

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Persistir en localStorage en cada cambio
  useEffect(() => {
    localStorage.setItem("luma_cart_items", JSON.stringify(state.items));
  }, [state.items]);

  // ── Acciones helper ──────────────────────────────────────────────────────
  const addItem = (item) => dispatch({ type: "ADD_ITEM", payload: item });
  const removeItem = (variant_id) => dispatch({ type: "REMOVE_ITEM", payload: variant_id });
  const updateQuantity = (variant_id, quantity) =>
    dispatch({ type: "UPDATE_QUANTITY", payload: { variant_id, quantity } });
  const clearCart = () => dispatch({ type: "CLEAR" });
  const openCart = () => dispatch({ type: "OPEN_CART" });
  const closeCart = () => dispatch({ type: "CLOSE_CART" });
  const toggleCart = () => dispatch({ type: "TOGGLE_CART" });

  // ── Derivados ─────────────────────────────────────────────────────────────
  const itemCount = state.items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = state.items.reduce(
    (acc, i) => acc + i.unit_price * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        isOpen: state.isOpen,
        itemCount,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        openCart,
        closeCart,
        toggleCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
