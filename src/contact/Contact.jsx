import React, { useState } from "react";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";
import RevealImage from "../component/ui/RevealImage";
import Spinner from "../component/ui/Spinner";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmissionStatus(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || "Unable to send your message.");
      }
      setSubmissionStatus({ type: "success", message: "Message sent." });
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (submitError) {
      setSubmissionStatus({
        type: "error",
        message: submitError.message || "Unable to send your message.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="w-full min-h-screen flex flex-col md:flex-row text-black">
      {/* Left Side - Form */}
      <div className="bg-white px-4 md:px-32 py-16 md:py-48 flex flex-col justify-between w-full md:w-[50%]">
        <div>
          {/* Title */}
          <AnimatedPageTitle
            title="Contact"
            className="text-7xl md:text-8xl font-bold mb-16"
          />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Name and Email Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold mb-3 tracking-wide">
                  NAME
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border-b border-gray-300 pb-2 text-sm placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-3 tracking-wide">
                  EMAIL
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="Your Email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border-b border-gray-300 pb-2 text-sm placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-3 tracking-wide">
                SUBJECT
              </label>
              <input
                type="text"
                name="subject"
                placeholder="How can we help?"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full border-b border-gray-300 pb-2 text-sm placeholder-gray-400 focus:outline-none focus:border-black transition-colors"
              />
            </div>

            {/* Message Field */}
            <div>
              <label className="block text-xs font-semibold mb-3 tracking-wide">
                MESSAGE
              </label>
              <textarea
                name="message"
                placeholder="Your Message"
                value={formData.message}
                onChange={handleChange}
                rows={4}
                className="w-full border-b border-gray-300 pb-2 text-sm placeholder-gray-400 focus:outline-none focus:border-black transition-colors resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center bg-black text-white px-8 py-3 text-sm font-semibold hover:bg-gray-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Spinner label="Sending" /> : "SEND"}
            </button>
          </form>
          {submissionStatus && (
            <p
              role={submissionStatus.type === "error" ? "alert" : "status"}
              className={`mt-4 text-sm ${submissionStatus.type === "error" ? "text-red-700" : "text-emerald-700"}`}
            >
              {submissionStatus.message}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 md:mt-20">
            <div>
              <p className="text-xs font-semibold mb-3 tracking-wide">
                (LOCATION)
              </p>
              <p className="text-sm font-medium">19A Mulero Street, Agege</p>
              <p className="text-sm font-medium">Nigeria, Lagos</p>
            </div>

            <div>
              <p className="text-xs font-semibold mb-3 tracking-wide">
                (PHONE)
              </p>
              <p className="text-sm font-medium">09012285529</p>
            </div>
          </div>
        </div>

        {/* Contact Info */}
      </div>

      {/* Right Side - Image */}
      <RevealImage
        src="/img/goth-tower2.jpg"
        alt="Modern minimalist store interior with wooden furniture and shelving"
        className="h-[320px] sm:h-[420px] md:h-auto w-full md:w-[50%]"
      />
    </section>
  );
};

export default Contact;
