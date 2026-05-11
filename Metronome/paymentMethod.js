require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { createMetronomeCustomer } = require("./customer_signup");


async function createSetupCheckoutSession(customer, options = {}) {
  
  if (!customer?.stripeCustomerId) {
    throw new Error(
      "customer.stripeCustomerId is missing — pass the object returned by createMetronomeCustomer()"
    );
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customer.stripeCustomerId,
    payment_method_types: ["card"],
    ui_mode: "hosted_page",
    success_url: "https://stripe.com"
  });

  return checkoutSession
}

(async () => {
    try {
      const customer = await createMetronomeCustomer();
 
      const session = await createSetupCheckoutSession(customer);
 
      console.log("\nShare this URL with your customer to set up payment:");
      console.log(session.url);
    } catch (err) {
      console.error("Setup failed:", err.message);
      process.exit(1);
    }
  })();
