"use client";

import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FavoriteIcon from "@mui/icons-material/Favorite";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import { useState } from "react";
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
  Menu,
  MenuItem,
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
    label: "Discover",
    href: "/discover",
    icon: <FavoriteIcon />,
    description: "Top items by score, type, genre, and confidence.",
  },
  {
    label: "Watchlist",
    href: "/watchlist",
    icon: <PlaylistAddCheckIcon />,
    description: "Prioritized backlog and watchlist items.",
  },
  {
    label: "Upcoming",
    href: "/upcoming",
    icon: <CalendarMonthIcon />,
    description: "Track release dates and review discovery candidates.",
  },
  {
    label: "Compare",
    href: "/compare",
    icon: <CompareArrowsIcon />,
    description: "Make pairwise picks that sharpen your rankings.",
  },
  {
    label: "Friends",
    href: "/friends",
    icon: <PeopleIcon />,
    description: "Local friend ratings, overlap, and compatibility.",
  },
  {
    label: "Insights",
    href: "/insights",
    icon: <BarChartIcon />,
    description:
      "Genre distribution, strengths, low-data areas, and media mix.",
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
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showAddMedia = pathname !== "/media/new";
  const [profileMenuAnchor, setProfileMenuAnchor] =
    useState<HTMLElement | null>(null);
  const profileMenuOpen = Boolean(profileMenuAnchor);

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
        <Toolbar
          sx={{
            alignItems: "center",
            borderBottom: `1px solid ${alpha("#BFDBFE", 0.08)}`,
            gap: { xs: 0.75, md: 1 },
            minHeight: 60,
            px: { xs: 1, md: 1.5 },
            py: 0.75,
          }}
        >
          <Box
            action="/media"
            component="form"
            method="get"
            sx={{
              alignItems: "center",
              backdropFilter: "blur(16px)",
              background: alpha("#050812", 0.36),
              border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
              borderRadius: "8px",
              color: "text.secondary",
              display: "flex",
              flex: { xs: 1, lg: "0 1 632px" },
              gap: 1,
              maxWidth: { lg: 632 },
              minHeight: 38,
              minWidth: 0,
              px: 1.2,
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
              placeholder="Search for movies, shows, games..."
              sx={{ color: "inherit", flex: 1, minWidth: 0 }}
            />
          </Box>
          <Box sx={{ flex: 1 }} />
          {showAddMedia ? (
            <Button
              href="/media/new"
              startIcon={<AddIcon />}
              sx={{
                background: alpha("#050812", 0.34),
                border: `1px solid ${alpha("#BFDBFE", 0.13)}`,
                boxShadow: "none",
                color: "text.primary",
                fontSize: 12,
                minHeight: 36,
                minWidth: 0,
                px: { xs: 1, sm: 1.2 },
                whiteSpace: "nowrap",
                "&:hover": {
                  background: alpha("#FFFFFF", 0.055),
                  borderColor: alpha(noirTokens.accent.purple, 0.36),
                  boxShadow: "none",
                },
              }}
              variant="outlined"
            >
              Add
            </Button>
          ) : null}
          <IconButton
            aria-label="Notifications"
            sx={{
              bgcolor: "transparent",
              border: 0,
              color: "text.secondary",
              display: { xs: "none", sm: "inline-flex" },
              height: 36,
              width: 36,
              "&:hover": {
                bgcolor: alpha("#FFFFFF", 0.055),
                boxShadow: "none",
              },
            }}
          >
            <NotificationsNoneIcon fontSize="small" />
          </IconButton>
          <Button
            aria-controls={profileMenuOpen ? "profile-menu" : undefined}
            aria-expanded={profileMenuOpen ? "true" : undefined}
            aria-haspopup="true"
            onClick={(event) => setProfileMenuAnchor(event.currentTarget)}
            sx={{
              bgcolor: "transparent",
              border: 0,
              boxShadow: "none",
              color: "text.primary",
              display: { xs: "none", sm: "inline-flex" },
              gap: 0.7,
              minHeight: 38,
              minWidth: 0,
              px: 0.35,
              "&:hover": {
                bgcolor: "transparent",
                boxShadow: "none",
              },
            }}
          >
            <Avatar
              sx={{
                bgcolor: alpha(noirTokens.accent.purple, 0.18),
                border: `1px solid ${alpha(noirTokens.accent.purple, 0.28)}`,
                color: noirTokens.accent.blue,
                fontSize: 12,
                fontWeight: 900,
                height: 28,
                width: 28,
              }}
            >
              D
            </Avatar>
            <Typography sx={{ fontSize: 12.5, fontWeight: 850 }}>
              Daniel
            </Typography>
            <KeyboardArrowDownIcon
              sx={{ color: "text.secondary", fontSize: 17 }}
            />
          </Button>
          <Menu
            anchorEl={profileMenuAnchor}
            id="profile-menu"
            onClose={() => setProfileMenuAnchor(null)}
            open={profileMenuOpen}
            slotProps={{
              paper: {
                sx: {
                  bgcolor: alpha("#08111F", 0.98),
                  border: `1px solid ${alpha("#BFDBFE", 0.12)}`,
                  borderRadius: "8px",
                  minWidth: 176,
                },
              },
            }}
          >
            <MenuItem
              component="a"
              href="/profile"
              onClick={() => setProfileMenuAnchor(null)}
            >
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>
            <MenuItem
              component="a"
              href="/settings"
              onClick={() => setProfileMenuAnchor(null)}
            >
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
          </Menu>
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
