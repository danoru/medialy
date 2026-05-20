"use client";

import AddIcon from "@mui/icons-material/Add";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FavoriteIcon from "@mui/icons-material/Favorite";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LightModeIcon from "@mui/icons-material/LightMode";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import MovieIcon from "@mui/icons-material/Movie";
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
  BottomNavigation,
  BottomNavigationAction,
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
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { usePathname } from "next/navigation";
import { useThemeMode } from "@/lib/theme-mode";

const drawerWidth = 232;
const mobileNavHeight = 64;
const topBarHeight = 56;

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <DashboardIcon />,
    description: "Library, recommendations, watchlist, and health signals.",
  },
  {
    label: "Media",
    href: "/media",
    icon: <MovieIcon />,
    description: "Browse, filter, add, and edit your local media.",
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
    description: "Pairwise picks that sharpen your rankings.",
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
    description: "Genre distribution, strengths, low-data areas.",
  },
  {
    label: "Data Health",
    href: "/data-health",
    icon: <HealthAndSafetyIcon />,
    description: "Missing metadata, low comparison coverage, duplicates.",
  },
  {
    label: "Import / Export",
    href: "/import-export",
    icon: <ImportExportIcon />,
    description: "JSON, CSV, and XLSX workflows.",
  },
];

const mobilePrimaryNavHrefs = [
  "/dashboard",
  "/media",
  "/discover",
  "/watchlist",
] as const;

const mobilePrimaryNav = navItems.filter((item) =>
  mobilePrimaryNavHrefs.includes(
    item.href as (typeof mobilePrimaryNavHrefs)[number],
  ),
);

const mobileSecondaryNav = navItems.filter(
  (item) =>
    !mobilePrimaryNavHrefs.includes(
      item.href as (typeof mobilePrimaryNavHrefs)[number],
    ),
);

export function AppShell({
  children,
  userName,
  userInitial,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userInitial?: string | null;
}) {
  const displayName = userName ?? "Guest";
  const displayInitial = userInitial ?? "G";
  const pathname = usePathname();
  const { mode, toggleMode } = useThemeMode();
  const showAddMedia = pathname !== "/media/new";
  const [profileMenuAnchor, setProfileMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const profileMenuOpen = Boolean(profileMenuAnchor);
  const mobileBottomValue =
    mobilePrimaryNav.find((item) => isSelectedPath(pathname, item.href))
      ?.href ?? "more";

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        elevation={0}
        position="fixed"
        sx={{
          bgcolor: "background.default",
          ml: { md: `${drawerWidth}px` },
          width: { md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar
          sx={{
            alignItems: "center",
            borderBottom: (theme) =>
              `1px solid ${theme.palette.border.subtle}`,
            gap: 1,
            minHeight: topBarHeight,
            px: { xs: 1.5, md: 2 },
          }}
        >
          <Box
            action="/media"
            component="form"
            method="get"
            sx={{
              alignItems: "center",
              bgcolor: "surface.1",
              border: (theme) => `1px solid ${theme.palette.border.subtle}`,
              borderRadius: 2,
              color: "text.secondary",
              display: "flex",
              flex: { xs: 1, lg: "0 1 480px" },
              gap: 1,
              height: 36,
              minWidth: 0,
              px: 1.25,
              transition: "border-color 160ms ease, background-color 160ms ease",
              "&:focus-within": {
                borderColor: "border.strong",
                bgcolor: "surface.2",
                color: "text.primary",
              },
            }}
          >
            <SearchIcon sx={{ fontSize: 18 }} />
            <InputBase
              inputProps={{ "aria-label": "Search media library" }}
              name="filter"
              placeholder="Search"
              sx={{
                color: "text.primary",
                flex: 1,
                fontSize: "0.875rem",
                minWidth: 0,
              }}
            />
          </Box>

          <Box sx={{ flex: 1 }} />

          {showAddMedia ? (
            <Button
              href="/media/new"
              startIcon={<AddIcon sx={{ fontSize: 18 }} />}
              variant="contained"
              sx={{
                height: 36,
                px: 1.5,
                whiteSpace: "nowrap",
              }}
            >
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                Add media
              </Box>
            </Button>
          ) : null}

          <Tooltip title={mode === "dark" ? "Switch to light" : "Switch to dark"}>
            <IconButton
              aria-label="Toggle color mode"
              onClick={toggleMode}
              sx={{ height: 36, width: 36 }}
            >
              {mode === "dark" ? (
                <LightModeIcon sx={{ fontSize: 18 }} />
              ) : (
                <DarkModeIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>

          <Button
            aria-controls={profileMenuOpen ? "profile-menu" : undefined}
            aria-expanded={profileMenuOpen ? "true" : undefined}
            aria-haspopup="true"
            onClick={(event) => setProfileMenuAnchor(event.currentTarget)}
            sx={{
              color: "text.primary",
              display: { xs: "none", sm: "inline-flex" },
              gap: 0.75,
              height: 36,
              minWidth: 0,
              px: 0.75,
            }}
          >
            <Avatar
              sx={{
                bgcolor: (theme) => alpha(theme.palette.accent.primary, 0.16),
                color: "primary.main",
                fontSize: "0.75rem",
                fontWeight: 600,
                height: 24,
                width: 24,
              }}
            >
              {displayInitial}
            </Avatar>
            <Typography
              variant="labelMd"
              component="span"
              sx={{ fontWeight: 550 }}
            >
              {displayName}
            </Typography>
            <KeyboardArrowDownIcon
              sx={{ color: "text.secondary", fontSize: 16 }}
            />
          </Button>
          <Menu
            anchorEl={profileMenuAnchor}
            id="profile-menu"
            onClose={() => setProfileMenuAnchor(null)}
            open={profileMenuOpen}
            slotProps={{ paper: { sx: { minWidth: 176 } } }}
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
            bgcolor: "background.default",
            borderRight: (theme) => `1px solid ${theme.palette.border.subtle}`,
            boxSizing: "border-box",
            color: "text.primary",
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
          }}
        >
          <Toolbar
            sx={{
              alignItems: "center",
              gap: 1,
              minHeight: topBarHeight,
              px: 2,
            }}
          >
            <Box
              sx={{
                alignItems: "center",
                bgcolor: "primary.main",
                borderRadius: 1,
                color: "primary.contrastText",
                display: "flex",
                fontFamily: (theme) => theme.typography.h6.fontFamily,
                fontSize: "0.875rem",
                fontWeight: 700,
                height: 24,
                justifyContent: "center",
                width: 24,
              }}
            >
              M
            </Box>
            <Typography
              sx={{
                fontFamily: (theme) => theme.typography.h6.fontFamily,
                fontSize: "0.95rem",
                fontWeight: 650,
                letterSpacing: "-0.01em",
              }}
            >
              Medialy
            </Typography>
          </Toolbar>
          <Divider />
          <List component="nav" sx={{ flex: 1, overflowY: "auto", p: 1 }}>
            {navItems.map((item) => {
              const selected = isSelectedPath(pathname, item.href);
              return (
                <ListItemButton
                  href={item.href}
                  key={item.href}
                  selected={selected}
                  sx={{
                    color: selected ? "text.primary" : "text.secondary",
                    gap: 1,
                    mb: 0.25,
                    minHeight: 34,
                    px: 1.25,
                    "& .MuiListItemIcon-root": {
                      color: selected ? "primary.main" : "text.secondary",
                      minWidth: 0,
                    },
                    "&:hover": {
                      bgcolor: (theme) =>
                        alpha(theme.palette.text.primary, 0.04),
                      color: "text.primary",
                      "& .MuiListItemIcon-root": { color: "text.primary" },
                    },
                  }}
                >
                  <ListItemIcon>
                    <Box
                      sx={{
                        alignItems: "center",
                        display: "flex",
                        "& svg": { fontSize: 18 },
                      }}
                    >
                      {item.icon}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    disableTypography
                    primary={
                      <Typography
                        variant="labelMd"
                        sx={{
                          fontWeight: selected ? 600 : 500,
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

      <Drawer
        anchor="bottom"
        onClose={() => setMobileMoreOpen(false)}
        open={mobileMoreOpen}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            bgcolor: "background.paper",
            borderTop: (theme) => `1px solid ${theme.palette.border.subtle}`,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "82vh",
            pb: "max(14px, env(safe-area-inset-bottom))",
          },
        }}
      >
        <Box sx={{ px: 1.5, py: 1.5 }}>
          <Box
            sx={{
              bgcolor: "border.default",
              borderRadius: 999,
              height: 4,
              mb: 1.5,
              mx: "auto",
              width: 40,
            }}
          />
          <Typography variant="eyebrow" sx={{ display: "block", mb: 1, px: 1 }}>
            More
          </Typography>
          <List component="nav" sx={{ p: 0 }}>
            {mobileSecondaryNav.map((item) => (
              <MobileDrawerItem
                item={item}
                key={item.href}
                onClick={() => setMobileMoreOpen(false)}
                selected={isSelectedPath(pathname, item.href)}
              />
            ))}
            <Divider sx={{ my: 0.75 }} />
            <MobileDrawerItem
              item={{
                description: "Your account profile.",
                href: "/profile",
                icon: <PersonIcon />,
                label: "Profile",
              }}
              onClick={() => setMobileMoreOpen(false)}
              selected={isSelectedPath(pathname, "/profile")}
            />
            <MobileDrawerItem
              item={{
                description: "Application settings.",
                href: "/settings",
                icon: <SettingsIcon />,
                label: "Settings",
              }}
              onClick={() => setMobileMoreOpen(false)}
              selected={isSelectedPath(pathname, "/settings")}
            />
          </List>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          pb: {
            xs: `calc(${mobileNavHeight}px + 1rem + env(safe-area-inset-bottom))`,
            md: 3,
          },
          pt: { xs: 2, md: 3 },
          px: { xs: 1.5, sm: 2, md: 3 },
        }}
      >
        <Toolbar sx={{ minHeight: topBarHeight }} />
        {children}
      </Box>

      <Box
        sx={{
          bgcolor: "background.paper",
          borderTop: (theme) => `1px solid ${theme.palette.border.subtle}`,
          bottom: 0,
          display: { xs: "block", md: "none" },
          left: 0,
          pb: "env(safe-area-inset-bottom)",
          position: "fixed",
          right: 0,
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <BottomNavigation
          onChange={(_, nextValue: string) => {
            if (nextValue === "more") {
              setMobileMoreOpen(true);
            }
          }}
          showLabels
          sx={{
            bgcolor: "transparent",
            height: mobileNavHeight,
            "& .MuiBottomNavigationAction-root": {
              color: "text.secondary",
              minWidth: 0,
              px: 0.5,
              "&.Mui-selected": { color: "primary.main" },
              "& svg": { fontSize: 20 },
            },
            "& .MuiBottomNavigationAction-label": {
              fontSize: "0.6875rem",
              fontWeight: 500,
              mt: 0.25,
              whiteSpace: "nowrap",
              "&.Mui-selected": { fontSize: "0.6875rem", fontWeight: 600 },
            },
          }}
          value={mobileBottomValue}
        >
          {mobilePrimaryNav.map((item) => (
            <BottomNavigationAction
              component="a"
              href={item.href}
              icon={item.icon}
              key={item.href}
              label={item.label === "Dashboard" ? "Home" : item.label}
              value={item.href}
            />
          ))}
          <BottomNavigationAction
            icon={<MoreHorizIcon />}
            label="More"
            value="more"
          />
        </BottomNavigation>
      </Box>
    </Box>
  );
}

function MobileDrawerItem({
  item,
  onClick,
  selected,
}: {
  item: NavItem;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <ListItemButton
      href={item.href}
      onClick={onClick}
      selected={selected}
      sx={{
        color: selected ? "text.primary" : "text.secondary",
        gap: 1,
        mb: 0.25,
        minHeight: 44,
        px: 1.25,
        "& .MuiListItemIcon-root": {
          color: selected ? "primary.main" : "text.secondary",
          minWidth: 0,
        },
      }}
    >
      <ListItemIcon>
        <Box
          sx={{
            alignItems: "center",
            display: "flex",
            "& svg": { fontSize: 20 },
          }}
        >
          {item.icon}
        </Box>
      </ListItemIcon>
      <ListItemText
        disableTypography
        primary={
          <Typography
            variant="labelMd"
            sx={{ fontWeight: selected ? 600 : 500 }}
          >
            {item.label}
          </Typography>
        }
        secondary={
          <Typography variant="caption" color="text.secondary">
            {item.description}
          </Typography>
        }
      />
    </ListItemButton>
  );
}

function isSelectedPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
