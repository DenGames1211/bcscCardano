import customtkinter as ctk
from tkinter import filedialog, messagebox
import os
import estimator

ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

class TraceToolApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Cardano Trace Tool")
        self.geometry("600x300")
        self.resizable(False, False)

        # Paths
        self.csv_path = ctk.StringVar()
        self.script_path = ctk.StringVar()

        self.create_widgets()

    def create_widgets(self):
        ctk.CTkLabel(
            self,
            text="Transaction Trace Processor",
            font=ctk.CTkFont(size=20, weight="bold")
        ).pack(pady=15)

        # CSV selector frame
        frame1 = ctk.CTkFrame(self)
        frame1.pack(pady=5)

        ctk.CTkLabel(frame1, text="CSV File:", width=80).pack(side="left", padx=(0,5))
        self.file_entry = ctk.CTkEntry(frame1, textvariable=self.csv_path, width=300)
        self.file_entry.pack(side="left", padx=(0,5))
        browse_btn = ctk.CTkButton(frame1, text="Browse", command=self.select_csv_file)
        browse_btn.pack(side="left")

        # Raw TX selector frame
        frame2 = ctk.CTkFrame(self)
        frame2.pack(pady=5)

        ctk.CTkLabel(frame2, text="Raw-TX File:", width=80).pack(side="left", padx=(0,5))
        self.raw_entry = ctk.CTkEntry(frame2, textvariable=self.script_path, width=300)
        self.raw_entry.pack(side="left", padx=(0,5))
        raw_browse = ctk.CTkButton(frame2, text="Browse", command=self.select_raw_file)
        raw_browse.pack(side="left")

        # Run button
        process_btn = ctk.CTkButton(self, text="Run Trace Tool", command=self.process_csv)
        process_btn.pack(pady=20)

        # Status label
        self.status_label = ctk.CTkLabel(self, text="")
        self.status_label.pack()

    def select_csv_file(self):
        path = filedialog.askopenfilename(filetypes=[("CSV files", "*.csv")])
        if path:
            self.csv_path.set(path)

    def select_raw_file(self):
        path = filedialog.askopenfilename(filetypes=[("Raw TX files", "*.plutus"), ("All files", "*.*")])
        if path:
            self.script_path.set(path)

    def process_csv(self):
        input_path = self.csv_path.get()
        script_path = self.script_path.get()

        # Validate inputs
        if not input_path.endswith(".csv") or not os.path.isfile(input_path):
            messagebox.showerror("Invalid file", "Please select a valid CSV file.")
            return
        if not script_path:
            messagebox.showerror("Invalid validator", "Please select a path for the validator file.")
            return

        try:
            # Define output file for results
            output_path = input_path.replace(".csv", "_output.csv")

            # Run the estimator pipeline with raw path
            estimator.main(input_path, output_path, script_path)

            self.status_label.configure(text=f"✅ Output written to:\n{output_path}")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to process file:\n{e}")
            self.status_label.configure(text="❌ Failed.")

if __name__ == "__main__":
    app = TraceToolApp()
    app.mainloop()
