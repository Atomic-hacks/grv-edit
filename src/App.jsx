import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { motion as Motion } from "framer-motion";
import Hero from "./component/Hero";
import Footer from "./component/layout/Footer";

import Shop from "./shop/Shop";
import Brand from "./brand/Brand";
import Journal from "./journal/Journal";
import JournalArticle from "./journal/JournalArticle";
import Contact from "./contact/Contact";
import About from "./about/About";
import PrivacyPolicy from "./privacy/PrivacyPolicy";
import SizeGuide from "./support/SizeGuide";
import Navbar from "./component/layout/Navbar";
import ProductDetail from "./ProductDetail";
import CartDrawer from "./component/cart/CartDrawer";
import CartPage from "./cart/CartPage";
import Brands from "./brands/Brands";
import BrandCatalogue from "./brands/BrandCatalogue";
import Catalogues from "./catalog/Catalogues";
import NewArrivals from "./shop/NewArrivals";
import GenderCatalogue from "./catalog/GenderCatalogue";
import ShopBy from "./shop/ShopBy";
import SignUp from "./auth/SignUp";
import LogIn from "./auth/LogIn";
import EmailConfirmed from "./auth/EmailConfirmed";
import ForgotPassword from "./auth/ForgotPassword";
import ResetPassword from "./auth/ResetPassword";
import ConfirmEmail from "./auth/ConfirmEmail";
import SectionPage from "./section/SectionPage";
import Faq from "./support/Faq";
import Unsubscribe from "./support/Unsubscribe";
import RequireAuth from "./component/auth/RequireAuth";
import AdminRoute from "./component/auth/AdminRoute";
import Wishlist from "./wishlist/Wishlist";
import NewsletterBanner from "./component/ui/NewsletterBanner";
import FirstOrderPromoBanner from "./component/ui/FirstOrderPromoBanner";
import Spinner from "./component/ui/Spinner";

// Checkout and account screens pull in the full country/state dataset
// via AddressFields. They are always reached by navigation, never as a
// landing page, so they load on demand.
const Checkout = React.lazy(() => import("./checkout/Checkout"));
const CheckoutComplete = React.lazy(() => import("./checkout/CheckoutComplete"));
const Account = React.lazy(() => import("./account/Account"));
const AccountSettings = React.lazy(() => import("./account/AccountSettings"));
const OrderDetail = React.lazy(() => import("./account/OrderDetail"));

// Admin is lazy-loaded: it is ~23 screens that no shopper ever opens,
// and bundling it with the storefront made every visitor download it.
const AdminHome = React.lazy(() => import("./admin/AdminHome"));
const AdminLayout = React.lazy(() => import("./component/admin/AdminLayout"));
const AdminSubcategories = React.lazy(() => import("./admin/AdminSubcategories"));
const AdminFilterTypes = React.lazy(() => import("./admin/AdminFilterTypes"));
const AdminCategoryFilterTypes = React.lazy(() => import("./admin/AdminCategoryFilterTypes"));
const AdminTags = React.lazy(() => import("./admin/AdminTags"));
const AdminBrands = React.lazy(() => import("./admin/AdminBrands"));
const AdminBrandForm = React.lazy(() => import("./admin/AdminBrandForm"));
const AdminProducts = React.lazy(() => import("./admin/AdminProducts"));
const AdminBulkUpload = React.lazy(() => import("./admin/AdminBulkUpload"));
const AdminProductForm = React.lazy(() => import("./admin/AdminProductForm"));
const AdminJournal = React.lazy(() => import("./admin/AdminJournal"));
const AdminJournalForm = React.lazy(() => import("./admin/AdminJournalForm"));
const AdminCustomers = React.lazy(() => import("./admin/AdminCustomers"));
const AdminCustomerDetail = React.lazy(() => import("./admin/AdminCustomerDetail"));
const AdminOrders = React.lazy(() => import("./admin/AdminOrders"));
const AdminOrderDetail = React.lazy(() => import("./admin/AdminOrderDetail"));
const AdminContactSubmissions = React.lazy(() => import("./admin/AdminContactSubmissions"));
const AdminDiscounts = React.lazy(() => import("./admin/AdminDiscounts"));
const AdminFirstOrderPromo = React.lazy(() => import("./admin/AdminFirstOrderPromo"));
const AdminShippingFees = React.lazy(() => import("./admin/AdminShippingFees"));
const AdminSiteImages = React.lazy(() => import("./admin/AdminSiteImages"));
const AdminSections = React.lazy(() => import("./admin/AdminSections"));
const AdminCampaigns = React.lazy(() => import("./admin/AdminCampaigns"));
const AdminCampaignForm = React.lazy(() => import("./admin/AdminCampaignForm"));

// Pages that end with <StoreSupport /> already carry a newsletter sign-up in
// that block. This list is the remainder — pages that would otherwise finish
// on the footer with no invitation to stay in touch.
const newsletterPaths = new Set([
  "/catalogues",
  "/brands",
  "/checkout",
  "/contact",
  "/journal",
  "/wishlist",
]);

const shouldShowNewsletter = (pathname) =>
  newsletterPaths.has(pathname) || pathname.startsWith("/sections/");

// Routing alone does not move the viewport, so following a product link from
// halfway down a grid used to open the product page already scrolled past its
// gallery. Restore the top of the page on every navigation, except when the
// URL only gained query params (filtering and sorting a listing in place).
const useScrollToTopOnNavigate = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
};

const AppLayout = () => {
  const location = useLocation();
  const hideNavbar = location.pathname === "/";
  useScrollToTopOnNavigate();

  return (
    <>
      <FirstOrderPromoBanner />
      {!hideNavbar && <Navbar />}
      <React.Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <Spinner label="Loading" className="text-sm text-gray-500" />
          </div>
        }
      >
      <Motion.div
        key={location.pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
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
        <Route path="/size-guide" element={<SizeGuide />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/sections/:slug" element={<SectionPage />} />
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
        <Route path="/archive" element={<GenderCatalogue facet="archive" />} />
        <Route path="/brand" element={<Brand />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/Departments" element={<Catalogues />} />
        <Route path="/journal/:slug" element={<JournalArticle />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/email-confirmed" element={<EmailConfirmed />} />
        <Route path="/confirm-email" element={<ConfirmEmail />} />
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
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/complete" element={<CheckoutComplete />} />
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <React.Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center">
                    <Spinner label="Loading" className="text-sm text-gray-500" />
                  </div>
                }
              >
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
                  <Route path="discounts" element={<AdminDiscounts />} />
                  <Route
                    path="first-order-promo"
                    element={<AdminFirstOrderPromo />}
                  />
                  <Route path="shipping-fees" element={<AdminShippingFees />} />
                  <Route path="site-images" element={<AdminSiteImages />} />
                  <Route path="sections" element={<AdminSections />} />
                  <Route path="sections/:id/edit" element={<AdminSections />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="orders/:id" element={<AdminOrderDetail />} />
                  <Route
                    path="contact-submissions"
                    element={<AdminContactSubmissions />}
                  />
                  <Route path="campaigns" element={<AdminCampaigns />} />
                  <Route path="campaigns/new" element={<AdminCampaignForm />} />
                  <Route path="campaigns/:id" element={<AdminCampaignForm />} />
                </Route>
                </Routes>
              </React.Suspense>
            </AdminRoute>
          }
        />
      </Routes>
      </Motion.div>
      </React.Suspense>

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
