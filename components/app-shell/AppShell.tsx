"use client";

import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FavoriteIcon from "@mui/icons-material/Favorite";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import MovieIcon from "@mui/icons-material/Movie";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import PeopleIcon from "@mui/icons-material/People";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import TuneIcon from "@mui/icons-material/Tune";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { usePathname } from "next/navigation";
import { noirTokens } from "@/components/cinematic/CinematicPrimitives";

const drawerWidth = 214;

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <DashboardIcon />,
    description:
      "Your library, recommendations, watchlist, and health signals.",
  },
  {
    label: "Media",
    href: "/media",
    icon: <MovieIcon />,
    description: "Browse, filter, add, and edit your local media.",
  },
  {
    label: "Compare",
    href: "/compare",
    icon: <CompareArrowsIcon />,
    description: "Make pairwise picks that sharpen your rankings.",
  },
  {
    label: "Recommendations",
    href: "/recommendations",
    icon: <AutoAwesomeIcon />,
    description: "Ranked local picks with scoring reasons.",
  },
  {
    label: "Upcoming",
    href: "/upcoming",
    icon: <CalendarMonthIcon />,
    description: "Track release dates and review discovery candidates.",
  },
  {
    label: "Discover",
    href: "/discover",
    icon: <FavoriteIcon />,
    description: "Top items by score, type, genre, and confidence.",
  },
  {
    label: "Insights",
    href: "/insights",
    icon: <BarChartIcon />,
    description:
      "Genre distribution, strengths, low-data areas, and media mix.",
  },
  {
    label: "Watchlist",
    href: "/watchlist",
    icon: <PlaylistAddCheckIcon />,
    description: "Prioritized backlog and watchlist items.",
  },
  {
    label: "Friends",
    href: "/friends",
    icon: <PeopleIcon />,
    description: "Local friend ratings, overlap, and compatibility.",
  },
  {
    label: "Data Health",
    href: "/data-health",
    icon: <HealthAndSafetyIcon />,
    description: "Missing metadata, low comparison coverage, and duplicates.",
  },
  {
    label: "Import / Export",
    href: "/import-export",
    icon: <ImportExportIcon />,
    description: "Local JSON, CSV, and XLSX workflows.",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <SettingsIcon />,
    description: "Manage local app preferences and database setup details.",
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showAddMedia = pathname !== "/media/new";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        elevation={0}
        position="fixed"
        sx={{
          background: "transparent",
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar sx={{ minHeight: 60, px: { xs: 1, md: 1.5 }, py: 0.75 }}>
          <Box
            sx={{
              alignItems: "center",
              backdropFilter: "blur(18px)",
              background:
                "linear-gradient(135deg, rgba(11, 16, 32, 0.68), rgba(8, 11, 18, 0.7))",
              border: `1px solid ${alpha("#BFDBFE", 0.13)}`,
              borderRadius: 1,
              boxShadow: `0 10px 34px ${alpha("#000000", 0.26)}`,
              display: "flex",
              gap: 1.2,
              minHeight: 42,
              px: { xs: 0.75, md: 1 },
              width: "100%",
            }}
          >
            <Box
              action="/media"
              component="form"
              method="get"
              sx={{
                alignItems: "center",
                border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
                borderRadius: 0.85,
                color: "text.secondary",
                display: "flex",
                flex: 1,
                gap: 1,
                maxWidth: { lg: 430 },
                ml: "auto",
                px: 1.2,
                py: 0.45,
                textDecoration: "none",
                transition: "border-color 160ms ease, color 160ms ease",
                "&:hover": {
                  borderColor: alpha(noirTokens.accent.blue, 0.34),
                  color: "text.primary",
                },
              }}
            >
              <SearchIcon fontSize="small" />
              <InputBase
                inputProps={{ "aria-label": "Search media library" }}
                name="filter"
                placeholder="Search media library..."
                sx={{ color: "inherit", flex: 1 }}
              />
            </Box>
            <IconButton
              aria-label="Notifications"
              sx={{
                border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
                color: "text.secondary",
                display: { xs: "none", sm: "inline-flex" },
              }}
            >
              <NotificationsNoneIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label="Tune dashboard"
              sx={{
                border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
                color: "text.secondary",
                display: { xs: "none", sm: "inline-flex" },
              }}
            >
              <TuneIcon fontSize="small" />
            </IconButton>
            {showAddMedia ? (
              <Button
                href="/media/new"
                startIcon={<AddIcon />}
                sx={{
                  background: `linear-gradient(135deg, ${alpha(noirTokens.accent.purple, 0.92)}, ${alpha(noirTokens.accent.blue, 0.78)})`,
                  border: `1px solid ${alpha("#FFFFFF", 0.16)}`,
                  boxShadow: `0 0 32px ${alpha(noirTokens.accent.purple, 0.22)}`,
                  color: "text.primary",
                  minWidth: 0,
                  px: { xs: 1, sm: 1.35 },
                  py: 0.45,
                  whiteSpace: "nowrap",
                }}
                variant="contained"
              >
                Add Media
              </Button>
            ) : null}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        open
        sx={{
          display: { xs: "none", md: "block" },
          flexShrink: 0,
          width: drawerWidth,
          "& .MuiDrawer-paper": {
            background:
              "linear-gradient(180deg, rgba(8, 11, 18, 0.98), rgba(11, 16, 32, 0.98) 48%, rgba(8, 11, 18, 0.98))",
            borderRight: `1px solid ${alpha("#BFDBFE", 0.12)}`,
            boxSizing: "border-box",
            color: "text.primary",
            overflow: "hidden",
            width: drawerWidth,
          },
        }}
        variant="permanent"
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            position: "relative",
            "&::before": {
              background: `radial-gradient(circle at 20% 0%, ${alpha(noirTokens.accent.purple, 0.22)}, transparent 15rem)`,
              content: '""',
              inset: 0,
              pointerEvents: "none",
              position: "absolute",
            },
          }}
        >
          <Toolbar sx={{ minHeight: 60, px: 1.75, position: "relative" }}>
            <Box>
              <Typography
                sx={{
                  fontWeight: 950,
                  fontSize: 17,
                  letterSpacing: 2.4,
                  lineHeight: 1,
                }}
                variant="h6"
              >
                MEDIALY
              </Typography>
              <Typography color="text.secondary" variant="caption">
                Personal media universe
              </Typography>
            </Box>
          </Toolbar>
          <Divider sx={{ borderColor: alpha("#BFDBFE", 0.08) }} />
          <List
            component="nav"
            sx={{ flex: 1, overflowY: "auto", p: 0.8, position: "relative" }}
          >
            {navItems.map((item) => {
              const selected =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <ListItemButton
                  href={item.href}
                  key={item.href}
                  selected={selected}
                  sx={{
                    border: `1px solid transparent`,
                    borderRadius: 0.9,
                    mb: 0.1,
                    minHeight: 33,
                    px: 0.85,
                    transition:
                      "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
                    "&.Mui-selected": {
                      background: `linear-gradient(135deg, ${alpha(noirTokens.accent.purple, 0.24)}, ${alpha(noirTokens.accent.blue, 0.11)})`,
                      borderColor: alpha(noirTokens.accent.purple, 0.28),
                      boxShadow: `0 0 28px ${alpha(noirTokens.accent.purple, 0.14)}`,
                      color: "#ffffff",
                      "& .MuiListItemIcon-root": {
                        color: noirTokens.accent.blue,
                      },
                    },
                    "&:hover": {
                      bgcolor: alpha("#BFDBFE", 0.07),
                      borderColor: alpha("#BFDBFE", 0.12),
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: "text.secondary", minWidth: 31 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        sx={{
                          fontSize: 12.25,
                          fontWeight: selected ? 800 : 650,
                        }}
                      >
                        {item.label}
                      </Typography>
                    }
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Box sx={{ p: 1, position: "relative" }}>
            <Box
              sx={{
                alignItems: "center",
                background: alpha("#BFDBFE", 0.055),
                border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
                borderRadius: 1,
                display: "flex",
                gap: 0.9,
                p: 0.8,
              }}
            >
              <Avatar
                sx={{
                  bgcolor: alpha(noirTokens.accent.purple, 0.2),
                  border: `1px solid ${alpha(noirTokens.accent.purple, 0.3)}`,
                  color: noirTokens.accent.blue,
                  fontSize: 13,
                  fontWeight: 900,
                  height: 28,
                  width: 28,
                }}
              >
                M
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: 12, fontWeight: 850 }}>
                  Local Profile
                </Typography>
                <Typography color="text.secondary" noWrap variant="caption">
                  SQLite intelligence
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 1, sm: 1.5, md: 2 },
          py: { xs: 1, md: 1.5 },
        }}
      >
        <Toolbar sx={{ minHeight: 60 }} />
        {children}
      </Box>
    </Box>
  );
}
