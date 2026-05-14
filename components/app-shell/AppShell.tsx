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
import PeopleIcon from "@mui/icons-material/People";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { usePathname } from "next/navigation";

const drawerWidth = 248;

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <DashboardIcon />,
    description: "Your library, recommendations, watchlist, and health signals.",
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
    description: "Track upcoming dates and review release candidates.",
  },
  {
    label: "Top Lists",
    href: "/top-lists",
    icon: <FavoriteIcon />,
    description: "Top items by score, type, genre, and confidence.",
  },
  {
    label: "Insights",
    href: "/insights",
    icon: <BarChartIcon />,
    description: "Genre distribution, strengths, low-data areas, and media mix.",
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
  const header = getHeader(pathname);
  const showAddMedia = pathname !== "/media/new";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        elevation={0}
        position="fixed"
        sx={{
          background: "rgba(7, 17, 29, 0.88)",
          backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${alpha("#9fb4d0", 0.12)}`,
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 68, px: { xs: 2, md: 3 } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              component="h1"
              sx={{ fontWeight: 800, lineHeight: 1.1 }}
              variant="h5"
            >
              {header.title}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {header.description}
            </Typography>
          </Box>
          {showAddMedia ? (
            <Button
              href="/media/new"
              startIcon={<AddIcon />}
              sx={{
                bgcolor: alpha("#8c6bff", 0.16),
                border: `1px solid ${alpha("#8c6bff", 0.36)}`,
                color: "text.primary",
                minWidth: 0,
                whiteSpace: "nowrap",
              }}
              variant="outlined"
            >
              Add Media
            </Button>
          ) : null}
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
              "linear-gradient(180deg, rgba(8, 18, 31, 0.98), rgba(6, 16, 27, 0.98))",
            borderRight: `1px solid ${alpha("#9fb4d0", 0.13)}`,
            boxSizing: "border-box",
            color: "text.primary",
            width: drawerWidth,
          },
        }}
        variant="permanent"
      >
        <Toolbar sx={{ minHeight: 68, px: 2 }}>
          <Box>
            <Typography sx={{ fontWeight: 900, letterSpacing: 3 }} variant="h6">
              MEDIALY
            </Typography>
            <Typography color="text.secondary" variant="caption">
              Media library
            </Typography>
          </Box>
        </Toolbar>
        <Divider sx={{ borderColor: alpha("#9fb4d0", 0.12) }} />
        <List component="nav" sx={{ p: 1 }}>
          {navItems.map((item) => {
            const selected =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <ListItemButton
                href={item.href}
                key={item.href}
                selected={selected}
                sx={{
                  borderRadius: 1.25,
                  mb: 0.25,
                  minHeight: 40,
                  "&.Mui-selected": {
                    bgcolor: alpha("#5b8cff", 0.24),
                    color: "#ffffff",
                    "& .MuiListItemIcon-root": { color: "#8fb8ff" },
                  },
                  "&:hover": { bgcolor: alpha("#9fb4d0", 0.08) },
                }}
              >
                <ListItemIcon sx={{ color: "text.secondary", minWidth: 38 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      sx={{ fontSize: 14, fontWeight: selected ? 700 : 500 }}
                    >
                      {item.label}
                    </Typography>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          px: { xs: 2, md: 3 },
          py: 2.5,
        }}
      >
        <Toolbar sx={{ minHeight: 68 }} />
        {children}
      </Box>
    </Box>
  );
}

function getHeader(pathname: string) {
  if (pathname === "/media/new") {
    return {
      title: "Add Media",
      description: "Create a local library item.",
    };
  }

  if (pathname.startsWith("/media/") && pathname.endsWith("/edit")) {
    return {
      title: "Edit Media",
      description: "Update details, tags, genres, notes, and ratings.",
    };
  }

  if (pathname.startsWith("/media/")) {
    return {
      title: "Media Details",
      description: "Review metadata, notes, comparisons, and library status.",
    };
  }

  const activeItem =
    navItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? {
      label: "Medialy",
      description: "Local recommendations, rankings, watchlist, and data health.",
    };

  return { title: activeItem.label, description: activeItem.description };
}
