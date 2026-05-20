import { Avatar } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * Shared avatar primitive for social pages. Honors the user's chosen
 * `avatarColor` when no image is available; falls back to the theme's
 * primary accent otherwise.
 */
export function UserAvatar({
  displayName,
  image,
  avatarColor,
  size = 44,
}: {
  displayName: string;
  image: string | null;
  avatarColor: string | null;
  size?: number;
}) {
  return (
    <Avatar
      src={image ?? undefined}
      sx={(theme) => ({
        bgcolor: avatarColor ?? alpha(theme.palette.primary.main, 0.14),
        color: avatarColor ? theme.palette.getContrastText(avatarColor) : "primary.main",
        fontWeight: 600,
        height: size,
        width: size,
      })}
    >
      {displayName.charAt(0).toUpperCase() || "?"}
    </Avatar>
  );
}
