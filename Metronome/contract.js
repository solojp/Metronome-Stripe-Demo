require("dotenv").config();
const { Metronome } = require("@metronome/sdk");

function getMetronomeClient() {
  if (!process.env.METRONOME_SECRET_KEY) {
    throw new Error("METRONOME_SECRET_KEY is not set");
  }
  return new Metronome({ bearerToken: process.env.METRONOME_SECRET_KEY });
}

async function createContract() {
    const client = getMetronomeClient();
    const body = {
        customer_id: '96efefb9-d323-46c3-a5c5-6fff7b95fe6b',
        rate_card_id: 'a8301a3e-9410-4569-b430-d2f428b00347',
        starting_at: '2026-05-07T00:00:00Z',
        billing_provider_configuration: {
            billing_provider: 'stripe', 
            delivery_method: 'direct_to_billing_provider',
        },
        commits: [{
            product_id: '8eb95285-05a5-40a6-b8f1-93d61d42a801',
            type: 'prepaid',
            access_schedule: {
                schedule_items: [{
                    amount: 2000,
                    starting_at: '2026-05-07T00:00:00Z',
                    ending_before: '2026-06-07T00:00:00Z'
                }],
            },
            invoice_schedule: {
                schedule_items: [{
                    timestamp: '2026-05-07T00:00:00Z',
                    amount: 20000,
                }]
            }
        }],
    }
    const contract = await client.v1.contracts.create(body);
    return contract

}

(async () => {
    try {
      const contract = await createContract();

      console.log(contract.data);
    } catch (err) {
      console.error("Contract failed", err.message);
      process.exit(1);
    }
  })();