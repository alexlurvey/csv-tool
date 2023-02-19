export const clamp = (x: number, lower: number, upper: number) => {
    if (x < lower) return lower;
    if (x > upper) return upper;
    return x;
}