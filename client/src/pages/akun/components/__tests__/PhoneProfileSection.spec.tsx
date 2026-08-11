import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhoneProfileSection } from "@/pages/akun/components/PhoneProfileSection";

describe("PhoneProfileSection", () => {
  it("menampilkan format lokal dan menyimpan nomor kanonik", async () => {
    const onSave = vi.fn().mockResolvedValue("6281234567890");
    render(<PhoneProfileSection currentPhone="6281111111111" isSaving={false} onSave={onSave} />);

    const input = screen.getByRole("textbox", { name: /Nomor HP aktif/ });
    expect(input).toHaveValue("081111111111");
    fireEvent.change(input, { target: { value: "081234567890" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Nomor HP" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("6281234567890"));
    expect(await screen.findByRole("status")).toHaveTextContent("berhasil diperbarui");
    expect(input).toHaveValue("081234567890");
  });

  it("menolak nomor yang mengandung tanda baca sebelum memanggil API", async () => {
    const onSave = vi.fn();
    render(<PhoneProfileSection currentPhone="6281111111111" isSaving={false} onSave={onSave} />);

    fireEvent.change(screen.getByRole("textbox", { name: /Nomor HP aktif/ }), {
      target: { value: "0812-3456-7890" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Nomor HP" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("tanpa spasi atau tanda baca");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("mengembalikan input ke nomor semula ketika dibatalkan", () => {
    render(<PhoneProfileSection currentPhone="6281111111111" isSaving={false} onSave={vi.fn()} />);

    const input = screen.getByRole("textbox", { name: /Nomor HP aktif/ });
    fireEvent.change(input, { target: { value: "081222222222" } });
    fireEvent.click(screen.getByRole("button", { name: "Batal" }));

    expect(input).toHaveValue("081111111111");
    expect(screen.queryByRole("button", { name: "Batal" })).not.toBeInTheDocument();
  });
});
