import { RowData } from "./csv";

export const clamp = (x: number, lower: number, upper: number) => {
    if (x < lower) return lower;
    if (x > upper) return upper;
    return x;
}

export const isValidRow = (row: RowData) => {
    return !isNaN(row.price) && !isNaN(row.unit_sales);
}