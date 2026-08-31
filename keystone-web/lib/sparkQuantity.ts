export type SparkQuantityInfo = {
  quantity?: number
  itemQuantity?: number
  bankQuantity?: number
  bankQuantityKnown?: boolean
}

export function formatSparkQuantity(info: SparkQuantityInfo): string {
  const total = info.itemQuantity ?? info.quantity ?? 0
  if (info.bankQuantityKnown === true && (info.bankQuantity ?? 0) > 0) {
    return `${total} (${info.bankQuantity} en el banco)`
  }
  return String(total)
}
