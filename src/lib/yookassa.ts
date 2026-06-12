import { YooCheckout } from '@a2seven/yoo-checkout'

let checkout: YooCheckout | null = null

function getCheckout(): YooCheckout {
  if (!checkout) {
    checkout = new YooCheckout({
      shopId: process.env.YOOKASSA_SHOP_ID!,
      secretKey: process.env.YOOKASSA_SECRET_KEY!,
    })
  }
  return checkout
}

export async function createPayment(
  orderId: string,
  amount: number,
  description: string,
  returnUrl: string
) {
  return getCheckout().createPayment(
    {
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: returnUrl },
      description,
      metadata: { order_id: orderId },
      capture: true,
    },
    orderId
  )
}
