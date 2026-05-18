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
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import MovieIcon from "@mui/icons-material/Movie";
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
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { usePathname } from "next/navigation";
import { noirTokens } from "@/components/cinematic/CinematicPrimitives";

const drawerWidth = 214;
const mobileNavHeight = 68;

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
              placeholder="Search media..."
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
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                Add
              </Box>
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
              const selected = isSelectedPath(pathname, item.href);

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

      <Drawer
        anchor="bottom"
        onClose={() => setMobileMoreOpen(false)}
        open={mobileMoreOpen}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            background:
              "linear-gradient(180deg, rgba(8, 17, 31, 0.99), rgba(5, 8, 18, 0.99))",
            borderTop: `1px solid ${alpha("#BFDBFE", 0.14)}`,
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
            color: "text.primary",
            maxHeight: "82vh",
            pb: "max(14px, env(safe-area-inset-bottom))",
          },
        }}
      >
        <Box sx={{ px: 1.2, py: 1 }}>
          <Box
            sx={{
              bgcolor: alpha("#BFDBFE", 0.2),
              borderRadius: "999px",
              height: 4,
              mx: "auto",
              mb: 1.2,
              width: 44,
            }}
          />
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 1.4,
              mb: 0.8,
              textTransform: "uppercase",
            }}
          >
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
            <Divider sx={{ borderColor: alpha("#BFDBFE", 0.1), my: 0.75 }} />
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
          px: { xs: 1, sm: 1.5, md: 2 },
          pb: {
            xs: `calc(${mobileNavHeight}px + 1rem + env(safe-area-inset-bottom))`,
            md: 1.5,
          },
          pt: { xs: 1, md: 1.5 },
        }}
      >
        <Toolbar sx={{ minHeight: 60 }} />
        {children}
      </Box>

      <Box
        sx={{
          backdropFilter: "blur(18px)",
          bgcolor: alpha("#050812", 0.92),
          borderTop: `1px solid ${alpha("#BFDBFE", 0.12)}`,
          bottom: 0,
          boxShadow: `0 -18px 48px ${alpha("#000000", 0.36)}`,
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
              color: alpha("#E2E8F0", 0.62),
              minWidth: 0,
              px: 0.3,
              "&.Mui-selected": {
                color:
                  mobileBottomValue === "more"
                    ? noirTokens.accent.blue
                    : "#FFFFFF",
              },
            },
            "& .MuiBottomNavigationAction-label": {
              fontSize: 10.5,
              fontWeight: 780,
              mt: 0.2,
              whiteSpace: "nowrap",
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
  item: (typeof navItems)[number];
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <ListItemButton
      href={item.href}
      onClick={onClick}
      selected={selected}
      sx={{
        border: `1px solid ${selected ? alpha(noirTokens.accent.purple, 0.28) : "transparent"}`,
        borderRadius: "8px",
        mb: 0.25,
        minHeight: 44,
        px: 1,
        "&.Mui-selected": {
          background: `linear-gradient(135deg, ${alpha(noirTokens.accent.purple, 0.24)}, ${alpha(noirTokens.accent.blue, 0.11)})`,
          color: "#ffffff",
          "& .MuiListItemIcon-root": {
            color: noirTokens.accent.blue,
          },
        },
      }}
    >
      <ListItemIcon sx={{ color: "text.secondary", minWidth: 34 }}>
        {item.icon}
      </ListItemIcon>
      <ListItemText
        primary={
          <Typography sx={{ fontSize: 13, fontWeight: selected ? 850 : 720 }}>
            {item.label}
          </Typography>
        }
        secondary={
          <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>
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
