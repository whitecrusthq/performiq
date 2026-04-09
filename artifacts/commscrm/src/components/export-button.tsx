import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

interface ExportButtonProps {
  onExcel: () => void;
  onPdf: () => void;
  loading?: boolean;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
}

export function ExportButton({
  onExcel,
  onPdf,
  loading = false,
  label = "Export",
  size = "sm",
  variant = "outline",
}: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className="gap-2" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onExcel} className="gap-2.5 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          <span>Download Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPdf} className="gap-2.5 cursor-pointer">
          <FileText className="h-4 w-4 text-red-500" />
          <span>Download PDF</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
