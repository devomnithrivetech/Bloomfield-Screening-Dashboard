export type EmailStatus = "Unprocessed" | "Processing" | "Processed";

export interface EmailAttachment {
  filename: string;
  type: "excel" | "pdf" | "other";
  size: string;
}

export interface Email {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  date: string;
  time: string;
  body: string;
  snippet: string;
  attachments: EmailAttachment[];
  status: EmailStatus;
}

export const mockEmails: Email[] = [
  {
    id: "1",
    sender: "Marcus Webb, JLL Capital Markets",
    senderEmail: "mwebb@jll.com",
    subject: "Origination Screener — Providence Place at Collegeville Inn (PA) | Bridge | $18.5M",
    date: "Mar 13, 2026",
    time: "9:42 AM",
    body: "Brandon, Shana —\n\nAttached is the origination screener for Providence Place at the Collegeville Inn, a 113-unit IL/AL/MC community located in Collegeville, PA.\n\nThe sponsor is seeking $18.5M in bridge financing to fund the acquisition and a light renovation of common areas and select units. The property was built in 2004 and maintains a strong occupancy history averaging 91% over the past three years.\n\nKey highlights:\n• 113 units: 54 IL / 38 AL / 21 MC\n• Current occupancy: 89%\n• Trailing-12 NOI: $1.82M\n• Experienced operator with 12 communities across the Mid-Atlantic\n\nPlease let me know if you'd like to schedule a call to discuss further.\n\nBest,\nMarcus Webb\nManaging Director, JLL Capital Markets",
    snippet: "Brandon, Shana — Attached is the origination screener for Providence Place at the Collegeville Inn, a 113-unit IL/AL/MC community...",
    attachments: [{ filename: "Screener_ProvidencePlace_Collegeville.xlsx", type: "excel", size: "1.4 MB" }],
    status: "Processed",
  },
  {
    id: "2",
    sender: "Derek Holt, CBRE",
    senderEmail: "derek.holt@cbre.com",
    subject: "Senior Housing Opp — La Sonora at Dove Mountain | Bridge | $14.2M",
    date: "Mar 18, 2026",
    time: "2:15 PM",
    body: "Team —\n\nPlease find attached the financing memo for La Sonora at Dove Mountain, a 186-unit IL/AL/MC community in Marana, AZ.\n\nThe borrower is requesting $14.2M in bridge financing for acquisition. The property is well-positioned in the growing Tucson MSA with limited new supply in the immediate trade area.\n\nProperty overview:\n• 186 units: 80 IL / 68 AL / 38 MC\n• Year built: 2008\n• Current occupancy: 85%\n• Trailing-12 NOI: $1.45M\n• Sponsor plans to invest $2.1M in capital improvements\n\nHappy to discuss at your convenience.\n\nDerek Holt\nSenior Vice President, CBRE",
    snippet: "Team — Please find attached the financing memo for La Sonora at Dove Mountain, a 186-unit IL/AL/MC community in Marana, AZ...",
    attachments: [{ filename: "Financing_Memo_LaSonora.pdf", type: "pdf", size: "3.2 MB" }],
    status: "Processing",
  },
  {
    id: "3",
    sender: "Rachel Simmons, Newmark",
    senderEmail: "rachel.simmons@nmrk.com",
    subject: "Multifamily Acquisition — The Vue at Waterford Lakes (FL) | Perm | $22.0M",
    date: "Mar 17, 2026",
    time: "11:30 AM",
    body: "Hi Shana —\n\nSharing the investment summary for The Vue at Waterford Lakes, a 240-unit Class B multifamily asset in Orlando, FL.\n\nThe sponsor is seeking $22.0M in permanent financing following a successful value-add renovation. Occupancy has improved from 82% to 95% since acquisition.\n\nDeal summary:\n• 240 units, garden-style\n• Year built: 1998, renovated 2024-2025\n• Current occupancy: 95%\n• Stabilized NOI: $2.1M\n• Renovation completed on 180 of 240 units\n\nLet me know your thoughts.\n\nRachel Simmons\nDirector, Newmark",
    snippet: "Hi Shana — Sharing the investment summary for The Vue at Waterford Lakes, a 240-unit Class B multifamily asset in Orlando...",
    attachments: [{ filename: "InvestmentSummary_VueWaterford.pdf", type: "pdf", size: "2.8 MB" }],
    status: "Unprocessed",
  },
  {
    id: "4",
    sender: "Tom Avery, Walker & Dunlop",
    senderEmail: "tavery@walkerdunlop.com",
    subject: "Hospitality Refi — Courtyard by Marriott Greenville (SC) | Bridge | $9.8M",
    date: "Mar 16, 2026",
    time: "4:05 PM",
    body: "Shana, Brandon —\n\nPlease review the attached refinancing package for the Courtyard by Marriott in Greenville, SC.\n\nThe property is a 120-key select-service hotel built in 2012 with strong RevPAR performance in the Greenville market. The sponsor is seeking $9.8M in bridge financing to refinance existing debt and fund a PIP renovation.\n\nKey metrics:\n• 120 keys\n• Trailing-12 RevPAR: $98.50\n• Trailing-12 NOI: $1.15M\n• PIP budget: $1.8M\n• Franchise agreement through 2038\n\nBest regards,\nTom Avery\nSenior Vice President, Walker & Dunlop",
    snippet: "Shana, Brandon — Please review the attached refinancing package for the Courtyard by Marriott in Greenville, SC. The property...",
    attachments: [{ filename: "Refi_Package_CourtyardGreenville.xlsx", type: "excel", size: "1.1 MB" }],
    status: "Processed",
  },
  {
    id: "5",
    sender: "Lisa Chen, Berkadia",
    senderEmail: "lisa.chen@berkadia.com",
    subject: "Senior Living — Magnolia Gardens at Peachtree (GA) | Construction | $16.7M",
    date: "Mar 15, 2026",
    time: "10:20 AM",
    body: "Team —\n\nAttached is the preliminary screener for Magnolia Gardens, a proposed 150-unit memory care and assisted living development in Peachtree City, GA.\n\nThe developer is seeking $16.7M in construction financing for a ground-up build on an entitled 8.5-acre parcel. Pre-leasing is expected to begin Q4 2026.\n\nProject details:\n• 150 units: 90 AL / 60 MC\n• Estimated completion: Q2 2028\n• Projected stabilized NOI: $2.3M\n• Developer has completed 6 similar projects in the Southeast\n• Site is fully entitled with all permits in hand\n\nPlease advise on interest level.\n\nLisa Chen\nManaging Director, Berkadia",
    snippet: "Team — Attached is the preliminary screener for Magnolia Gardens, a proposed 150-unit memory care and assisted living development...",
    attachments: [{ filename: "Screener_MagnoliaGardens.xlsx", type: "excel", size: "980 KB" }],
    status: "Processing",
  },
  {
    id: "6",
    sender: "James Kowalski, Cushman & Wakefield",
    senderEmail: "james.kowalski@cushwake.com",
    subject: "Multifamily Bridge — Riverton Crossings (MI) | Bridge | $7.4M",
    date: "Mar 14, 2026",
    time: "3:45 PM",
    body: "Hi team —\n\nForwarding the financing request for Riverton Crossings, a 96-unit garden-style apartment community in Grand Rapids, MI.\n\nThe sponsor acquired the property in 2023 and has completed exterior renovations. They are now seeking $7.4M in bridge financing to fund interior unit upgrades on the remaining 60 units.\n\nProperty highlights:\n• 96 units, 2- and 3-bedroom\n• Year built: 1995\n• Current occupancy: 92%\n• In-place rents 15% below market\n• Renovation budget: $18,000/unit\n\nLooking forward to your feedback.\n\nJames Kowalski\nVice President, Cushman & Wakefield",
    snippet: "Hi team — Forwarding the financing request for Riverton Crossings, a 96-unit garden-style apartment community in Grand Rapids...",
    attachments: [],
    status: "Unprocessed",
  },
  {
    id: "7",
    sender: "Angela Price, HFF",
    senderEmail: "aprice@hff.com",
    subject: "Senior Housing Portfolio — Sunrise Collection (TX) | Perm | $24.5M",
    date: "Mar 12, 2026",
    time: "8:55 AM",
    body: "Shana —\n\nAttached please find the offering memorandum for the Sunrise Collection, a 3-property senior housing portfolio across the Dallas-Fort Worth metroplex.\n\nThe sponsor is seeking $24.5M in permanent financing to take out bridge debt following stabilization of all three assets.\n\nPortfolio summary:\n• 3 properties, 320 total units\n• Average occupancy: 93%\n• Combined trailing-12 NOI: $3.4M\n• Properties built between 2010-2015\n• All properties under single management platform\n\nPlease let me know if the team would like a walkthrough.\n\nAngela Price\nDirector, HFF",
    snippet: "Shana — Attached please find the offering memorandum for the Sunrise Collection, a 3-property senior housing portfolio across DFW...",
    attachments: [{ filename: "OM_SunriseCollection.pdf", type: "pdf", size: "5.1 MB" }],
    status: "Unprocessed",
  },
  {
    id: "8",
    sender: "Kevin O'Brien, Marcus & Millichap",
    senderEmail: "kobrien@marcusmillichap.com",
    subject: "Hospitality Acquisition — Hampton Inn & Suites Savannah (GA) | Bridge | $12.1M",
    date: "Mar 11, 2026",
    time: "1:30 PM",
    body: "Brandon, Shana —\n\nPlease see the attached investment brief for the Hampton Inn & Suites in historic downtown Savannah, GA.\n\nThe property is a 142-key select-service hotel with strong leisure demand and consistent occupancy. The buyer is seeking $12.1M in bridge financing for acquisition.\n\nInvestment highlights:\n• 142 keys\n• Year built: 2016\n• Trailing-12 occupancy: 78%\n• Trailing-12 RevPAR: $112.30\n• Trailing-12 NOI: $1.65M\n• No immediate PIP required\n\nHappy to connect on this one.\n\nKevin O'Brien\nSenior Associate, Marcus & Millichap",
    snippet: "Brandon, Shana — Please see the attached investment brief for the Hampton Inn & Suites in historic downtown Savannah...",
    attachments: [{ filename: "InvestmentBrief_HamptonSavannah.pdf", type: "pdf", size: "2.4 MB" }],
    status: "Processed",
  },
];
