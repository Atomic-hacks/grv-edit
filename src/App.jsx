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
import About from "./about/About";
import PrivacyPolicy from "./privacy/PrivacyPolicy";
import Navbar from "./component/layout/Navbar";
import ProductDetail from "./ProductDetail";
import CartDrawer from "./component/cart/CartDrawer";
import Brands from "./brands/Brands";
import BrandCatalogue from "./brands/BrandCatalogue";
import Catalogues from "./catalog/Catalogues";
import NewArrivals from "./shop/NewArrivals";
import GenderCatalogue from "./catalog/GenderCatalogue";
import ShopBy from "./shop/ShopBy";
import SignUp from "./auth/SignUp";
import LogIn from "./auth/LogIn";
import ForgotPassword from "./auth/ForgotPassword";
import ResetPassword from "./auth/ResetPassword";
import Account from "./account/Account";
import AccountSettings from "./account/AccountSettings";
import OrderDetail from "./account/OrderDetail";
import Checkout from "./checkout/Checkout";
import CheckoutComplete from "./checkout/CheckoutComplete";
import AdminHome from "./admin/AdminHome";
import AdminLayout from "./component/admin/AdminLayout";
import AdminSubcategories from "./admin/AdminSubcategories";
import AdminFilterTypes from "./admin/AdminFilterTypes";
import AdminCategoryFilterTypes from "./admin/AdminCategoryFilterTypes";
import AdminTags from "./admin/AdminTags";
import AdminBrands from "./admin/AdminBrands";
import AdminBrandForm from "./admin/AdminBrandForm";
import AdminProducts from "./admin/AdminProducts";
import AdminBulkUpload from "./admin/AdminBulkUpload";
import AdminProductForm from "./admin/AdminProductForm";
import AdminJournal from "./admin/AdminJournal";
import AdminJournalForm from "./admin/AdminJournalForm";
import AdminCustomers from "./admin/AdminCustomers";
import AdminCustomerDetail from "./admin/AdminCustomerDetail";
import AdminOrders from "./admin/AdminOrders";
import AdminOrderDetail from "./admin/AdminOrderDetail";
import AdminContactSubmissions from "./admin/AdminContactSubmissions";
import RequireAuth from "./component/auth/RequireAuth";
import AdminRoute from "./component/auth/AdminRoute";
import Wishlist from "./wishlist/Wishlist";
import NewsletterBanner from "./component/ui/NewsletterBanner";

const newsletterPathPattern =
  /^\/(men|women|accessories|athletics|footwear|lifestyle)(\/|$)/;

const shouldShowNewsletter = (pathname) =>
  pathname === "/" ||
  pathname === "/shop" ||
  pathname === "/shop-by" ||
  pathname === "/shop/new-arrivals" ||
  pathname === "/catalogues" ||
  pathname === "/brands" ||
  pathname.startsWith("/brands/") ||
  pathname.startsWith("/product/") ||
  pathname === "/checkout" ||
  pathname === "/contact" ||
  newsletterPathPattern.test(pathname);

const AppLayout = () => {
  const location = useLocation();
  const hideNavbar = location.pathname === "/";

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Hero />} />

        <Route path="/shop" element={<Shop />} />
        <Route path="/shop-by" element={<ShopBy />} />
        <Route path="/shop/new-arrivals" element={<NewArrivals />} />
        <Route
          path="/lifestyle"
          element={<GenderCatalogue facet="lifestyle" />}
        />
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
        <Route path="/Departments" element={<Catalogues />} />
        <Route path="/journal/:slug" element={<JournalArticle />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/account"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />
        <Route
          path="/account/settings"
          element={
            <RequireAuth>
              <AccountSettings />
            </RequireAuth>
          }
        />
        <Route path="/account/orders/:id" element={<OrderDetail />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/complete" element={<CheckoutComplete />} />
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <Routes>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminHome />} />
                  <Route
                    path="subcategories"
                    element={<AdminSubcategories />}
                  />
                  <Route path="filter-types" element={<AdminFilterTypes />} />
                  <Route
                    path="category-filter-types"
                    element={<AdminCategoryFilterTypes />}
                  />
                  <Route path="tags" element={<AdminTags />} />
                  <Route path="brands" element={<AdminBrands />} />
                  <Route path="brands/new" element={<AdminBrandForm />} />
                  <Route path="brands/:id/edit" element={<AdminBrandForm />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="products/new" element={<AdminProductForm />} />
                  <Route
                    path="products/bulk-upload"
                    element={<AdminBulkUpload />}
                  />
                  <Route
                    path="products/:id/edit"
                    element={<AdminProductForm />}
                  />
                  <Route path="journal" element={<AdminJournal />} />
                  <Route path="journal/new" element={<AdminJournalForm />} />
                  <Route
                    path="journal/:id/edit"
                    element={<AdminJournalForm />}
                  />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route
                    path="customers/:id"
                    element={<AdminCustomerDetail />}
                  />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="orders/:id" element={<AdminOrderDetail />} />
                  <Route
                    path="contact-submissions"
                    element={<AdminContactSubmissions />}
                  />
                </Route>
              </Routes>
            </AdminRoute>
          }
        />
      </Routes>

      {shouldShowNewsletter(location.pathname) && <NewsletterBanner />}
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
