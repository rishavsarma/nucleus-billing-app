const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
]
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return TENS[tens] + (ones ? " " + ONES[ones] : "")
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds) parts.push(ONES[hundreds] + " Hundred")
  if (rest) parts.push(twoDigits(rest))
  return parts.join(" ")
}

/** Indian numbering (crore/lakh/thousand), integer rupee part only — no paise. */
function integerToWords(n: number): string {
  if (n === 0) return "Zero"
  const crore = Math.floor(n / 10000000)
  const lakh = Math.floor((n % 10000000) / 100000)
  const thousand = Math.floor((n % 100000) / 1000)
  const hundred = n % 1000

  const parts: string[] = []
  if (crore) parts.push(threeDigits(crore) + " Crore")
  if (lakh) parts.push(twoDigits(lakh) + " Lakh")
  if (thousand) parts.push(twoDigits(thousand) + " Thousand")
  if (hundred) parts.push(threeDigits(hundred))
  return parts.join(" ")
}

/** e.g. amountToWords(43999) -> "Forty Three Thousand Nine Hundred Ninety Nine Rupees Only" */
export function amountToWords(amount: number, currencyWord = "Rupees"): string {
  const rounded = Math.round(amount)
  const words = integerToWords(Math.abs(rounded))
  const sign = rounded < 0 ? "Minus " : ""
  return `${sign}${words} ${currencyWord} Only`
}
