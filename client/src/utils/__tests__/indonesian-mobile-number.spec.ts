import {
  formatIndonesianMobileNumberForInput,
  normalizeIndonesianMobileNumber,
} from "@/utils/indonesian-mobile-number";

describe("Indonesian mobile number utilities", () => {
  it.each([
    ["081234567890", "6281234567890"],
    [" 081234567890 ", "6281234567890"],
    ["6281234567890", "6281234567890"],
  ])("menormalisasi %s menjadi %s", (input, expected) => {
    expect(normalizeIndonesianMobileNumber(input)).toBe(expected);
  });

  it.each(["", "+6281234567890", "0812-3456-7890", "0212345678", "nomor"])(
    "menolak format %s",
    (input) => expect(normalizeIndonesianMobileNumber(input)).toBeNull(),
  );

  it("menampilkan nomor kanonik sebagai format lokal untuk input", () => {
    expect(formatIndonesianMobileNumberForInput("6281234567890")).toBe("081234567890");
  });
});
