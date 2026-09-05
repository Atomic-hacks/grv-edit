import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Hero from "./component/Hero";
import Footer from "./component/layout/Footer";

import Shop from "./shop/Shop";
import Brand from "./brand/Brand";
import Journal from "./journal/Journal";
import JournalArticle from "./journal/JournalArticle";
import Contact from "./contact/Contact";
import Navbar from "./component/layout/Navbar";
import ProductDetail from "./ProductDetail";
import CartDrawer from "./component/cart/CartDrawer";
import Brands from "./brands/Brands";
import BrandCatalogue from "./brands/BrandCatalogue";
import Catalogues from "./catalog/Catalogues";
import NewArrivals from "./shop/NewArrivals";
import GenderCatalogue from "./catalog/GenderCatalogue";

const AppLayout = () => {
  const location = useLocation();
  const hideNavbar = location.pathname === "/";

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Hero />} />

        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/new-arrivals" element={<NewArrivals />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/catalogues" element={<Catalogues />} />
        <Route path="/brands" element={<Brands />} />
        <Route path="/brands/:slug" element={<BrandCatalogue />} />
        <Route path="/men" element={<GenderCatalogue facet="men" />} />
        <Route path="/women" element={<GenderCatalogue facet="women" />} />
        <Route
          path="/accessories"
          element={<GenderCatalogue facet="accessories" />}
        />
        <Route
          path="/athletics"
          element={<GenderCatalogue facet="athletics" />}
        />
        <Route
          path="/footwear"
          element={<GenderCatalogue facet="footwear" />}
        />
        <Route path="/brand" element={<Brand />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/journal/:slug" element={<JournalArticle />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>

      <Footer />
      <CartDrawer />
    </>
  );
};

const App = () => {
  return (
    <main className="relative mx-auto">
      <Router>
        <AppLayout />
      </Router>
    </main>
  );
};

export default App;
