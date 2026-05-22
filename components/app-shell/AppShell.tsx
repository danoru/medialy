"use client";

import AddIcon from "@mui/icons-material/Add";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DashboardIcon from "@mui/icons-material/Dashboard";
import FavoriteIcon from "@mui/icons-material/Favorite";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import ImportExportIcon from "@mui/icons-material/ImportExport";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
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
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  alpha,
} from "@mui/material";
import { usePathname } from "next/navigation";
import { signInAction, signOutAction } from "@/app/auth-actions";

const drawerWidth = 232;
const mobileNavHeight = 64;
const topBarHeight = 56;

type NavVisibility = "public" | "auth" | "admin";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
  visibility: NavVisibility;
  activePrefixes?: string[];
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <DashboardIcon />,
    description: "Library, recommendations, watchlist, and health signals.",
    visibility: "public",
  },
  {
    label: "Library",
    href: "/library",
    icon: <MovieIcon />,
    description: "Browse, filter, add, and edit your local media.",
    visibility: "public",
    activePrefixes: ["/media"],
  },
  {
    label: "Discover",
    href: "/discover",
    icon: <FavoriteIcon />,
    description: "Top items by score, type, genre, and confidence.",
    visibility: "public",
  },
  {
    label: "Watchlist",
    href: "/watchlist",
    icon: <PlaylistAddCheckIcon />,
    description: "Prioritized backlog and watchlist items.",
    visibility: "auth",
  },
  {
    label: "Upcoming",
    href: "/upcoming",
    icon: <CalendarMonthIcon />,
    description: "Track release dates and review discovery candidates.",
    visibility: "public",
  },
  {
    label: "Compare",
    href: "/compare",
    icon: <CompareArrowsIcon />,
    description: "Pairwise picks that sharpen your rankings.",
    visibility: "auth",
  },
  {
    label: "Friends",
    href: "/friends",
    icon: <PeopleIcon />,
    description: "Local friend ratings, overlap, and compatibility.",
    visibility: "auth",
  },
  {
    label: "Insights",
    href: "/insights",
    icon: <BarChartIcon />,
    description: "Genre distribution, strengths, low-data areas.",
    visibility: "public",
  },
  {
    label: "Data Health",
    href: "/data-health",
    icon: <HealthAndSafetyIcon />,
    description: "Missing metadata, low comparison coverage, duplicates.",
    visibility: "admin",
  },
  {
    label: "Import / Export",
    href: "/import-export",
    icon: <ImportExportIcon />,
    description: "JSON, CSV, and XLSX workflows.",
    visibility: "auth",
  },
];

function isItemVisible(
  item: NavItem,
  isAuthenticated: boolean,
  isAdmin: boolean,
) {
  if (item.visibility === "admin") return isAdmin;
  if (item.visibility === "auth") return isAuthenticated;
  return true;
}

// Mobile bottom-nav slots: anchor the first three to the most-used public
// destinations, then swap the fourth depending on session state so signed-in
// users still get one-tap Watchlist access.
const mobilePrimaryHrefsAuthed = [
  "/dashboard",
  "/library",
  "/discover",
  "/watchlist",
] as const;
const mobilePrimaryHrefsPublic = [
  "/dashboard",
  "/library",
  "/discover",
  "/upcoming",
] as const;

export function AppShell({
  children,
  userName,
  userInitial,
  isAuthenticated = false,
  isAdmin = false,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userInitial?: string | null;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
}) {
  const displayName = userName ?? "Guest";
  const displayInitial = userInitial ?? "G";
  const pathname = usePathname();
  const showAddMedia = pathname !== "/media/new";
  const [profileMenuAnchor, setProfileMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const profileMenuOpen = Boolean(profileMenuAnchor);
  const visibleNavItems = navItems.filter((item) =>
    isItemVisible(item, isAuthenticated, isAdmin),
  );
  const mobilePrimaryHrefs = isAuthenticated
    ? mobilePrimaryHrefsAuthed
    : mobilePrimaryHrefsPublic;
  const mobilePrimaryNav = mobilePrimaryHrefs
    .map((href) => visibleNavItems.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));
  const mobileSecondaryNav = visibleNavItems.filter(
    (item) => !mobilePrimaryHrefs.includes(item.href as never),
  );
  const mobileBottomValue =
    mobilePrimaryNav.find((item) =>
      isSelectedPath(pathname, item.href, item.activePrefixes),
    )?.href ?? "more";

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
            borderBottom: "1px solid",
            borderBottomColor: "border.subtle",
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
              border: "1px solid",
              borderColor: "border.subtle",
              borderRadius: 2,
              color: "text.secondary",
              display: "flex",
              flex: { xs: 1, lg: "0 1 480px" },
              gap: 1,
              height: 36,
              minWidth: 0,
              px: 1.25,
              transition:
                "border-color 160ms ease, background-color 160ms ease",
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
              sx={(theme) => ({
                background: `linear-gradient(135deg, ${theme.palette.accent.primary} 0%, ${alpha(theme.palette.accent.primary, 0.78)} 100%)`,
                border: `1px solid ${alpha(theme.palette.accent.primary, 0.55)}`,
                boxShadow: `0 0 0 1px ${alpha("#FFFFFF", 0.04)} inset, 0 2px 8px ${alpha(theme.palette.accent.primary, 0.45)}, 0 0 20px ${alpha(theme.palette.accent.primary, 0.35)}`,
                color: "#0A0810",
                fontWeight: 650,
                height: 36,
                position: "relative",
                px: 1.75,
                transition:
                  "transform 180ms ease, box-shadow 180ms ease, background 180ms ease",
                whiteSpace: "nowrap",
                "&::before": {
                  background: `linear-gradient(180deg, ${alpha("#FFFFFF", 0.22)} 0%, transparent 60%)`,
                  borderRadius: "inherit",
                  content: '""',
                  inset: 0,
                  pointerEvents: "none",
                  position: "absolute",
                },
                "&:hover": {
                  background: `linear-gradient(135deg, ${theme.palette.accent.primary} 0%, ${theme.palette.accent.primary} 100%)`,
                  boxShadow: `0 0 0 1px ${alpha("#FFFFFF", 0.06)} inset, 0 4px 14px ${alpha(theme.palette.accent.primary, 0.55)}, 0 0 28px ${alpha(theme.palette.accent.primary, 0.55)}`,
                  transform: "translateY(-1px)",
                },
                "&:active": {
                  transform: "translateY(0)",
                },
              })}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                Add media
              </Box>
            </Button>
          ) : null}

          {isAuthenticated ? (
            <>
              <Button
                aria-controls={profileMenuOpen ? "profile-menu" : undefined}
                aria-expanded={profileMenuOpen ? "true" : undefined}
                aria-haspopup="true"
                aria-label={`Account menu for ${displayName}`}
                onClick={(event) => setProfileMenuAnchor(event.currentTarget)}
                sx={{
                  color: "text.primary",
                  display: "inline-flex",
                  gap: 0.75,
                  height: 36,
                  minWidth: 0,
                  px: { xs: 0.25, sm: 0.75 },
                }}
              >
                <Avatar
                  sx={(theme) => ({
                    background: `radial-gradient(circle at 30% 30%, ${alpha(theme.palette.accent.primary, 0.32)} 0%, ${alpha(theme.palette.accent.primary, 0.14)} 100%)`,
                    border: `1px solid ${alpha(theme.palette.accent.primary, 0.55)}`,
                    boxShadow: `0 0 0 1px ${alpha("#FFFFFF", 0.04)} inset, 0 0 14px ${alpha(theme.palette.accent.primary, 0.45)}`,
                    color: "primary.main",
                    fontSize: "0.75rem",
                    fontWeight: 650,
                    height: 28,
                    transition: "box-shadow 180ms ease, transform 180ms ease",
                    width: 28,
                    "[aria-haspopup='true']:hover &": {
                      boxShadow: `0 0 0 1px ${alpha("#FFFFFF", 0.06)} inset, 0 0 22px ${alpha(theme.palette.accent.primary, 0.65)}`,
                      transform: "scale(1.04)",
                    },
                  })}
                >
                  {displayInitial}
                </Avatar>
                <Typography
                  variant="labelMd"
                  component="span"
                  sx={{
                    display: { xs: "none", sm: "inline" },
                    fontWeight: 550,
                  }}
                >
                  {displayName}
                </Typography>
                <KeyboardArrowDownIcon
                  sx={{
                    color: "text.secondary",
                    display: { xs: "none", sm: "inline-block" },
                    fontSize: 16,
                  }}
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
                {isAdmin ? (
                  <MenuItem
                    component="a"
                    href="/admin"
                    onClick={() => setProfileMenuAnchor(null)}
                  >
                    <ListItemIcon>
                      <AdminPanelSettingsIcon fontSize="small" />
                    </ListItemIcon>
                    Admin
                  </MenuItem>
                ) : null}
                <Divider />
                {/* Sign-out is a form posting to a server action so the
                    session cookie is cleared server-side and the user lands
                    on `/` as an anonymous visitor. */}
                <form action={signOutAction}>
                  <MenuItem
                    component="button"
                    type="submit"
                    sx={{ width: "100%" }}
                  >
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    Sign Out
                  </MenuItem>
                </form>
              </Menu>
            </>
          ) : (
            <Box
              action={signInAction.bind(null, pathname)}
              component="form"
              sx={{ display: "inline-flex" }}
            >
              <Button
                aria-label="Sign in"
                type="submit"
                startIcon={
                  <LoginIcon sx={{ fontSize: 18, mr: { xs: -0.5, sm: 0 } }} />
                }
                sx={{
                  color: "text.primary",
                  display: "inline-flex",
                  height: 36,
                  minWidth: 0,
                  px: { xs: 1, sm: 1.25 },
                }}
                variant="text"
              >
                <Typography
                  variant="labelMd"
                  component="span"
                  sx={{
                    display: { xs: "none", sm: "inline" },
                    fontWeight: 550,
                  }}
                >
                  Sign In
                </Typography>
              </Button>
            </Box>
          )}
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
            borderRight: "1px solid",
            borderRightColor: "border.subtle",
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
              sx={(theme) => ({
                alignItems: "center",
                background: `linear-gradient(140deg, ${theme.palette.accent.primary} 0%, ${alpha(theme.palette.accent.primary, 0.7)} 100%)`,
                border: `1px solid ${alpha(theme.palette.accent.primary, 0.65)}`,
                borderRadius: 1,
                boxShadow: `0 0 0 1px ${alpha("#FFFFFF", 0.08)} inset, 0 0 14px ${alpha(theme.palette.accent.primary, 0.5)}`,
                color: "#0A0810",
                display: "flex",
                fontFamily: theme.typography.h6.fontFamily,
                fontSize: "0.875rem",
                fontWeight: 700,
                height: 24,
                justifyContent: "center",
                position: "relative",
                width: 24,
                "&::before": {
                  background: `linear-gradient(180deg, ${alpha("#FFFFFF", 0.25)} 0%, transparent 60%)`,
                  borderRadius: "inherit",
                  content: '""',
                  inset: 0,
                  pointerEvents: "none",
                  position: "absolute",
                },
              })}
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
            {visibleNavItems.map((item) => {
              const selected = isSelectedPath(
                pathname,
                item.href,
                item.activePrefixes,
              );
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
          {/* <Divider /> */}
          {/* <Box sx={{ px: 2, py: 1.25 }}>
            <Typography
              component="a"
              href="https://icons8.com"
              rel="noopener noreferrer"
              target="_blank"
              variant="caption"
              sx={{
                color: "text.secondary",
                textDecoration: "none",
                "&:hover": { color: "text.primary" },
              }}
            >
              Icons by Icons8
            </Typography>
          </Box> */}
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
            borderTop: "1px solid",
            borderTopColor: "border.subtle",
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
                selected={isSelectedPath(
                  pathname,
                  item.href,
                  item.activePrefixes,
                )}
              />
            ))}
            <Divider sx={{ my: 0.75 }} />
            {isAuthenticated ? (
              <>
                <MobileDrawerItem
                  item={{
                    description: "Your account profile.",
                    href: "/profile",
                    icon: <PersonIcon />,
                    label: "Profile",
                    visibility: "auth",
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
                    visibility: "auth",
                  }}
                  onClick={() => setMobileMoreOpen(false)}
                  selected={isSelectedPath(pathname, "/settings")}
                />
                {isAdmin ? (
                  <MobileDrawerItem
                    item={{
                      description: "Moderation tools.",
                      href: "/admin",
                      icon: <AdminPanelSettingsIcon />,
                      label: "Admin",
                      visibility: "admin",
                    }}
                    onClick={() => setMobileMoreOpen(false)}
                    selected={isSelectedPath(pathname, "/admin")}
                  />
                ) : null}
                <form action={signOutAction}>
                  <ListItemButton
                    component="button"
                    type="submit"
                    sx={{ width: "100%" }}
                  >
                    <ListItemIcon>
                      <LogoutIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Sign Out"
                      secondary="End your session."
                    />
                  </ListItemButton>
                </form>
              </>
            ) : (
              <form action={signInAction.bind(null, pathname)}>
                <ListItemButton
                  component="button"
                  type="submit"
                  sx={{ width: "100%" }}
                >
                  <ListItemIcon>
                    <LoginIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="Sign In"
                    secondary="Sign in with Google to track your library."
                  />
                </ListItemButton>
              </form>
            )}
          </List>
          {/* <Divider sx={{ my: 1 }} />
          <Box sx={{ px: 2, py: 1, textAlign: "center" }}>
            <Typography
              component="a"
              href="https://icons8.com"
              rel="noopener noreferrer"
              target="_blank"
              variant="caption"
              sx={{
                color: "text.secondary",
                textDecoration: "none",
              }}
            >
              Icons by Icons8
            </Typography>
          </Box> */}
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
          borderTop: "1px solid",
          borderTopColor: "border.subtle",
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

function isSelectedPath(
  pathname: string,
  href: string,
  activePrefixes?: string[],
) {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  if (activePrefixes) {
    for (const prefix of activePrefixes) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
    }
  }
  return false;
}
