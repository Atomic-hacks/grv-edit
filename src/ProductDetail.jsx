import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  formatPrice,
  getProductById,
  getProductImages,
  getProducts,
} from "./data/products";
import { useCart } from "./context/CartContext";
import ProductImageSlider from "./component/ui/ProductImageSlider";

const ProductDetail = () => {
  const { id } = useParams();
  const product = useMemo(() => getProductById(id), [id]);
  const [selectedVariantId, setSelectedVariantId] = useState(
    product?.variants?.[0]?.id,
  );
  const { addToCart } = useCart();

  if (!product)
    return <main className="min-h-screen px-8 py-20">Product not found.</main>;

  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ||
    product.variants[0];
  const images = getProductImages(product, selectedVariant.id);
  const moreProducts = getProducts({ categoryId: product.categoryId })
    .filter((item) => item.id !== product.id)
    .slice(0, 4);
  const cartProduct = {
    ...product,
    price: product.basePrice,
    image: images[0],
    hoverImage: images[1] || images[0],
  };

  return (
    <main className="min-h-screen bg-white pb-20">
      <div className="px-6 py-6 text-xs text-gray-500 md:px-12">
        HOME / {product.categoryId.toUpperCase()} /{" "}
        {product.subcategory.toUpperCase()}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
        <div className="h-[70vh] lg:h-[85vh]">
          <ProductImageSlider images={images} alt={product.name} />
        </div>
        <section className="flex flex-col px-8 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
            {product.subcategory}
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{product.name}</h1>
          <p className="mt-2 text-lg">{formatPrice(product.basePrice)}</p>
          <p className="mt-8 text-sm leading-relaxed text-gray-600">
            {product.description}
          </p>
          <div className="mt-8">
            <p className="mb-3 text-sm font-semibold">
              Color: {selectedVariant.color}
            </p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`border px-4 py-2 text-sm ${selectedVariant.id === variant.id ? "border-black bg-black text-white" : "border-gray-300"}`}
                >
                  {variant.color}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => addToCart(cartProduct, 1)}
            className="mt-8 w-full bg-black py-4 text-sm font-semibold text-white hover:bg-(--color-accent-orange)"
          >
            ADD TO CART
          </button>
          <p className="mt-4 text-xs text-gray-500">
            SKU: {selectedVariant.sku} · Size: {selectedVariant.size}
          </p>
        </section>
      </div>
      <section className="px-1.5 py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-3xl font-semibold">More from this category</h2>
          <Link
            to={`/men?category=${product.categoryId}`}
            className="text-sm font-semibold underline"
          >
            VIEW CATEGORY
          </Link>
        </div>
        <div className="product-grid">
          {moreProducts.map((item) => (
            <Link key={item.id} to={`/product/${item.id}`}>
              <img
                src={item.variants[0].images[0]}
                alt={item.name}
                className="aspect-3/4 w-full object-cover"
              />
              <div className="mt-3 flex justify-between text-sm font-semibold">
                <span>{item.name}</span>
                <span>{formatPrice(item.basePrice)}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};

export default ProductDetail;