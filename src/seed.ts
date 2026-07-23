import { ReferenceItem, PortalSettings } from './types';

export const DEFAULT_SETTINGS: PortalSettings = {
  mainTitle: "Emergency Operation Center",
  subtitle: "Reference Portal",
  agencyName: "DSWD EOC • Operational Directory",
  logoUrl: "/src/assets/images/eoc_portal_logo_1784808168520.jpg",
  bannerUrl: "",
  bannerHeight: 220,
  primaryColor: "#0055A4",
  headerBgColor: "#003366"
};

export const DEFAULT_REFERENCES: Omit<ReferenceItem, 'id'>[] = [
  {
    title: "2026 TC Francisco EOC References",
    icon: "drive",
    category: "Google Drive",
    badge: "Main Folder",
    url: "https://drive.google.com/drive/folders/1example_eoc_drive_folder",
    description: "Centralized Google Drive repository containing all situational reports, operational directives, and response matrices.",
    visible: true,
    order: 1
  },
  {
    title: "FO6 - EOC Briefing Main Slides",
    icon: "slides",
    category: "Google Slides",
    badge: "Briefings",
    url: "https://docs.google.com/presentation/d/1example_eoc_briefing_slides",
    description: "Official presentation deck for daily status briefings, disaster timelines, and regional deployment metrics.",
    visible: true,
    order: 2
  },
  {
    title: "FO6 - EOC Objectives & Action Plan",
    icon: "slides",
    category: "Google Slides",
    badge: "Strategic Plan",
    url: "https://docs.google.com/presentation/d/1example_eoc_objectives_deck",
    description: "Operational response goals, cluster leads assignments, and emergency workflow directives.",
    visible: true,
    order: 3
  },
  {
    title: "FO6 - Virtual Meeting Link",
    icon: "meet",
    category: "Virtual Meetings",
    badge: "Google Meet",
    url: "https://meet.google.com/abc-defg-hij",
    description: "24/7 active virtual command center room for inter-agency coordination and hourly updates.",
    visible: true,
    order: 4
  },
  {
    title: "FO6 - FNIs Inventory Sheet",
    icon: "sheets",
    category: "Google Sheets",
    badge: "Inventory Matrix",
    url: "https://docs.google.com/spreadsheets/d/1example_fni_inventory_sheet",
    description: "Real-time tracker for Family Food Packs (FFPs), Non-Food Items (NFIs), logistics, and stockpile balances.",
    visible: true,
    order: 5
  },
  {
    title: "Disaster Response Standard Manual",
    icon: "pdf",
    category: "Guidelines & PDFs",
    badge: "Policy",
    url: "https://dswd.gov.ph/manuals/eoc_response_handbook.pdf",
    description: "Standard Operating Procedures (SOP), cluster protocols, and emergency relief distribution rules.",
    visible: true,
    order: 6
  }
];

// Pre-seeded owner email
export const PRIMARY_ADMIN_EMAIL = "mblvillareal@dswd.gov.ph";
