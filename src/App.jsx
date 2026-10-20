import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigationType,
  Navigate,
} from "react-router-dom";
import { motion as Motion } from "framer-motion";
import Hero from "./component/Hero";
import Footer from "./component/layout/Footer";

import Navbar from "./component/layout/Navbar";
import CartDrawer from "./component/cart/CartDrawer";
import CartPage from "./cart/CartPage";
import NotFound from "./NotFound";
import RequireAuth from "./component/auth/RequireAuth";
import AdminRoute from "./component/auth/AdminRoute";
import NewsletterBanner from "./component/ui/NewsletterBanner";
import FirstOrderPromoBanner from "./component/ui/FirstOrderPromoBanner";
import Spinner from "./component/ui/Spinner";
import { trackPageview } from "./lib/analytics";
import { trackVisit } from "./lib/visitTracking";
import { useAuth } from "./context/AuthContext";

const Shop = React.lazy(() => import("./shop/Shop"));
const Journal = React.lazy(() => import("./journal/Journal"));
const JournalArticle = React.lazy(() => import("./journal/JournalArticle"));
const Contact = React.lazy(() => import("./contact/Contact"));
const About = React.lazy(() => import("./about/About"));
const PrivacyPolicy = React.lazy(() => import("./privacy/PrivacyPolicy"));
const SizeGuide = React.lazy(() => import("./support/SizeGuide"));
const ProductDetail = React.lazy(() => import("./ProductDetail"));
const Brands = React.lazy(() => import("./brands/Brands"));
const BrandCatalogue = React.lazy(() => import("./brands/BrandCatalogue"));
const Catalogues = React.lazy(() => import("./catalog/Catalogues"));
const NewArrivals = React.lazy(() => import("./shop/NewArrivals"));
const CategoryPage = React.lazy(() => import("./catalog/CategoryPage"));
const ArchivePage = React.lazy(() => import("./catalog/ArchivePage"));
const ShopBy = React.lazy(() => import("./shop/ShopBy"));
const SignUp = React.lazy(() => import("./auth/SignUp"));
const LogIn = React.lazy(() => import("./auth/LogIn"));
const EmailConfirmed = React.lazy(() => import("./auth/EmailConfirmed"));
const ForgotPassword = React.lazy(() => import("./auth/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./auth/ResetPassword"));
const ConfirmEmail = React.lazy(() => import("./auth/ConfirmEmail"));
const SectionPage = React.lazy(() => import("./section/SectionPage"));
const Faq = React.lazy(() => import("./support/Faq"));
const Unsubscribe = React.lazy(() => import("./support/Unsubscribe"));
const Wishlist = React.lazy(() => import("./wishlist/Wishlist"));

// Checkout and account screens pull in the full country/state dataset
// via AddressFields. They are always reached by navigation, never as a
// landing page, so they load on demand.
const Checkout = React.lazy(() => import("./checkout/Checkout"));
const CheckoutComplete = React.lazy(
  () => import("./checkout/CheckoutComplete"),
);
const Account = React.lazy(() => import("./account/Account"));
const AccountSettings = React.lazy(() => import("./account/AccountSettings"));
const OrderDetail = React.lazy(() => import("./account/OrderDetail"));
const ReportIssue = React.lazy(() => import("./account/ReportIssue"));
const Welcome = React.lazy(() => import("./auth/Welcome"));

// Admin is lazy-loaded: it is ~23 screens that no shopper ever opens,
// and bundling it with the storefront made every visitor download it.
const AdminOperations = React.lazy(() => import("./admin/AdminOperations"));
const AdminWaitlist = React.lazy(() => import("./admin/AdminWaitlist"));
const AdminHome = React.lazy(() => import("./admin/AdminHome"));
const AdminLayout = React.lazy(() => import("./component/admin/AdminLayout"));
const AdminFilterTypes = React.lazy(() => import("./admin/AdminFilterTypes"));
const AdminTags = React.lazy(() => import("./admin/AdminTags"));
const AdminBrands = React.lazy(() => import("./admin/AdminBrands"));
const AdminBrandForm = React.lazy(() => import("./admin/AdminBrandForm"));
const AdminProducts = React.lazy(() => import("./admin/AdminProducts"));
const AdminBulkUpload = React.lazy(() => import("./admin/AdminBulkUpload"));
const AdminProductForm = React.lazy(() => import("./admin/AdminProductForm"));
const AdminJournal = React.lazy(() => import("./admin/AdminJournal"));
const AdminJournalForm = React.lazy(() => import("./admin/AdminJournalForm"));
const AdminCustomers = React.lazy(() => import("./admin/AdminCustomers"));
const AdminCustomerDetail = React.lazy(
  () => import("./admin/AdminCustomerDetail"),
);
const AdminOrders = React.lazy(() => import("./admin/AdminOrders"));
const AdminOrderDetail = React.lazy(() => import("./admin/AdminOrderDetail"));
const AdminContactSubmissions = React.lazy(
  () => import("./admin/AdminContactSubmissions"),
);
const AdminDiscounts = React.lazy(() => import("./admin/AdminDiscounts"));
const AdminFirstOrderPromo = React.lazy(
  () => import("./admin/AdminFirstOrderPromo"),
);
const AdminShippingFees = React.lazy(() => import("./admin/AdminShippingFees"));
const AdminCategories = React.lazy(() => import("./admin/AdminCategories"));
const AdminCampaigns = React.lazy(() => import("./admin/AdminCampaigns"));
const AdminCampaignForm = React.lazy(() => import("./admin/AdminCampaignForm"));
const AdminCases = React.lazy(() => import("./admin/AdminCases"));
const AdminAnalytics = React.lazy(() => import("./admin/AdminAnalytics"));
const AdminVisitors = React.lazy(() => import("./admin/AdminVisitors"));
const AdminStaff = React.lazy(() => import("./admin/AdminStaff"));
const AdminContentSections = React.lazy(
  () => import("./admin/AdminContentSections"),
);

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
const scrollPositions = new Map();
const useScrollToTopOnNavigate = () => {
  const { pathname, key } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = React.useRef(null);
  React.useLayoutEffect(() => {
    if (navigationType === "POP" || previousPath.current !== pathname) {
      window.scrollTo({ top: navigationType === "POP" ? scrollPositions.get(key) || 0 : 0, left: 0, behavior: "instant" });
    }
    previousPath.current = pathname;
    return () => {
      scrollPositions.set(key, window.scrollY);
      if (scrollPositions.size > 100) scrollPositions.delete(scrollPositions.keys().next().value);
    };
  }, [pathname, key, navigationType]);
};

// A SPA never reloads, so GA never sees a navigation on its own — one
// page_view per route change (including filter/sort changes via search
// params, which is a real change in what's on screen) has to be sent by
// hand.
const useAnalyticsPageview = () => {
  const location = useLocation();
  React.useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  // First-party count for the admin Visitors dashboard. Keyed on pathname
  // only (filter changes aren't new visits) and not on the token, so a
  // token refresh doesn't log a repeat view.
  const { session } = useAuth();
  const token = React.useRef(null);
  token.current = session?.access_token || null;
  React.useEffect(() => {
    trackVisit(location.pathname, token.current);
  }, [location.pathname]);
};

const AppLayout = () => {
  const location = useLocation();
  const hideNavbar = location.pathname === "/";
  React.useLayoutEffect(() => {
    const labels = { "/": "GRV HQ", "/shop": "Shop", "/catalogues": "Departments", "/cart": "Goody Bag", "/account": "Your account", "/checkout": "Checkout", "/admin": "Admin" };
    const label = labels[location.pathname] || location.pathname.split("/").filter(Boolean).slice(0, 2).map((part) => part.replace(/-/g, " ")).join(" · ");
    document.title = location.pathname === "/" ? "GRV HQ" : `${label.charAt(0).toUpperCase()}${label.slice(1)} | GRV HQ`;
  }, [location.pathname]);
  useScrollToTopOnNavigate();
  useAnalyticsPageview();

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
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/size-guide" element={<SizeGuide />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/sections/:slug" element={<SectionPage />} />
            <Route path="/catalogues" element={<Catalogues />} />
            <Route path="/brands" element={<Brands />} />
            <Route path="/brands/:slug" element={<BrandCatalogue />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/brand" element={<Navigate to="/about" replace />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/Departments" element={<Navigate to="/catalogues" replace />} />
            <Route path="/journal/:slug" element={<JournalArticle />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/:categorySlug" element={<CategoryPage />} />
            <Route path="/:categorySlug/*" element={<CategoryPage />} />
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
            <Route path="/account/report-issue" element={<ReportIssue />} />
            <Route path="/welcome" element={<Welcome />} />
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
                        <Spinner
                          label="Loading"
                          className="text-sm text-gray-500"
                        />
                      </div>
                    }
                  >
                    <Routes>
                      <Route element={<AdminLayout />}>
                        <Route index element={<AdminHome />} />
                        <Route path="operations" element={<AdminOperations />} />
                        <Route path="waitlist" element={<AdminWaitlist />} />
                        <Route
                          path="categories"
                          element={<AdminCategories />}
                        />
                        <Route
                          path="filter-types"
                          element={<AdminFilterTypes />}
                        />
                        <Route path="tags" element={<AdminTags />} />
                        <Route path="brands" element={<AdminBrands />} />
                        <Route path="brands/new" element={<AdminBrandForm />} />
                        <Route
                          path="brands/:id/edit"
                          element={<AdminBrandForm />}
                        />
                        <Route path="products" element={<AdminProducts />} />
                        <Route
                          path="products/new"
                          element={<AdminProductForm />}
                        />
                        <Route
                          path="products/bulk-upload"
                          element={<AdminBulkUpload />}
                        />
                        <Route
                          path="products/:id/edit"
                          element={<AdminProductForm />}
                        />
                        <Route path="journal" element={<AdminJournal />} />
                        <Route
                          path="content-sections"
                          element={<AdminContentSections />}
                        />
                        <Route
                          path="journal/new"
                          element={<AdminJournalForm />}
                        />
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
                        <Route
                          path="shipping-fees"
                          element={<AdminShippingFees />}
                        />
                        <Route path="orders" element={<AdminOrders />} />
                        <Route
                          path="orders/:id"
                          element={<AdminOrderDetail />}
                        />
                        <Route
                          path="contact-submissions"
                          element={<AdminContactSubmissions />}
                        />
                        <Route path="campaigns" element={<AdminCampaigns />} />
                        <Route
                          path="campaigns/new"
                          element={<AdminCampaignForm />}
                        />
                        <Route
                          path="campaigns/:id"
                          element={<AdminCampaignForm />}
                        />
                        <Route path="cases" element={<AdminCases />} />
                        <Route path="analytics" element={<AdminAnalytics />} />
                        <Route path="visitors" element={<AdminVisitors />} />
                        <Route path="staff" element={<AdminStaff />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Routes>
                  </React.Suspense>
                </AdminRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
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
