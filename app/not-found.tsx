import SearchOffIcon from "@mui/icons-material/SearchOff";
import { StatePanel } from "@/components/shared/StatePanel";

export default function NotFound() {
  return (
    <StatePanel
      action={{ href: "/dashboard", label: "Go to dashboard" }}
      description="The page or media item you were looking for is not available."
      icon={<SearchOffIcon sx={{ fontSize: 42 }} />}
      minHeight={360}
      title="Nothing found"
    />
  );
}
