/**
 * Sample Data for WP Content Engine (Briants of Risborough Edition)
 */

export const DEFAULT_SITE_SETTINGS = {
  domain: "https://briantsofrisborough.co.uk",
  blogSubpath: "/blog/",
  uploadYear: "2026",
  uploadMonth: "06",
  linksBank: [
    { url: "https://briantsofrisborough.co.uk/garden-machinery", label: "STIHL Garden Machinery Range" },
    { url: "https://briantsofrisborough.co.uk/chainsaws", label: "Professional & Domestic Chainsaws" },
    { url: "https://briantsofrisborough.co.uk/lawnmowers", label: "Lawnmowers & Robotic Mowers" },
    { url: "https://briantsofrisborough.co.uk/servicing", label: "Machinery Servicing & Repairs" }
  ]
};

export const SAMPLE_IMAGE_POOL = [
  {
    id: "img_1",
    filename: "STIHL-Garden-Machinery.jpg",
    url: "https://briantsofrisborough.co.uk/wp-content/uploads/2026/06/STIHL-Garden-Machinery.jpg",
    title: "STIHL Garden Machinery Display",
    tags: ["stihl", "machinery", "garden", "chainsaw", "tools"]
  },
  {
    id: "img_2",
    filename: "Professional-Chainsaw-Maintenance.jpg",
    url: "https://briantsofrisborough.co.uk/wp-content/uploads/2026/06/Professional-Chainsaw-Maintenance.jpg",
    title: "Professional Chainsaw Service & Sharpening",
    tags: ["chainsaw", "maintenance", "safety", "service", "tree"]
  },
  {
    id: "img_3",
    filename: "Lawnmower-Robotic-Mowers.jpg",
    url: "https://briantsofrisborough.co.uk/wp-content/uploads/2026/06/Lawnmower-Robotic-Mowers.jpg",
    title: "Lawnmowers and iMOW Robotic Mowers",
    tags: ["lawnmower", "robot", "imow", "lawn", "grass"]
  }
];

export const SAMPLE_POST_PAYLOADS = [
  {
    title: "How to Cut a Tree Safely: The Complete STIHL Guide",
    slug: "how-to-cut-a-tree-safely",
    categories: ["Chainsaws", "Garden Advice"],
    tags: ["tree-cutting", "stihl", "chainsaw", "safety"],
    yoast_meta_title: "How to Cut a Tree Safely | Briants of Risborough",
    yoast_meta_desc: "Learn how to cut down a tree safely with STIHL chainsaws. Step-by-step safety gear, felling notch techniques, and maintenance tips.",
    content_html: `
<p>Cutting down a tree requires proper preparation, safety gear, and reliable equipment. Before starting any felling work, ensure your workspace is clear and your equipment is fully serviced.</p>

<h2>1. Choosing the Right Safety Gear & Equipment</h2>
<p>Always equip yourself with chainsaw-resistant trousers, helmet with visor, ear defenders, and anti-vibration gloves. For professional equipment recommendations, explore our <a href="https://briantsofrisborough.co.uk/chainsaws">Professional & Domestic Chainsaws</a> range.</p>

<h2>2. Assessing the Tree & Felling Plan</h2>
<p>Examine the natural lean of the tree, wind direction, and branch distribution. Establish a clear escape route at a 45-degree angle behind the planned direction of fall.</p>

<table>
  <thead>
    <tr>
      <th>Tree Size (Diameter)</th>
      <th>Recommended STIHL Chainsaw</th>
      <th>Guide Bar Length</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Up to 30 cm</td>
      <td>STIHL MS 180 / MS 211</td>
      <td>14" - 16"</td>
    </tr>
    <tr>
      <td>30 cm to 50 cm</td>
      <td>STIHL MS 261 C-M</td>
      <td>16" - 18"</td>
    </tr>
    <tr>
      <td>50 cm+ (Heavy Duty)</td>
      <td>STIHL MS 500i</td>
      <td>20" - 25"</td>
    </tr>
  </tbody>
</table>

<h2>3. Executing the Directional Felling Cut</h2>
<p>Make the directional notch facing the direction you want the tree to fall. For routine equipment checkups or chain sharpening, visit our <a href="https://briantsofrisborough.co.uk/servicing">Machinery Servicing & Repairs</a> department.</p>
`,
    image_placeholders: []
  },
  {
    title: "Essential Lawnmower Maintenance Tips for Spring Lawn Care",
    slug: "essential-lawnmower-maintenance-tips-spring",
    categories: ["Lawn Care", "Machinery Maintenance"],
    tags: ["lawnmower", "spring", "lawn", "servicing"],
    yoast_meta_title: "Spring Lawnmower Maintenance Tips | Briants of Risborough",
    yoast_meta_desc: "Prepare your lawnmower for spring with our essential maintenance guide covering oil changes, blade sharpening, spark plugs, and fuel care.",
    content_html: `
<p>Spring is the ideal time to get your lawnmower in peak condition after winter storage. A well-maintained mower ensures a cleaner cut and healthier lawn growth.</p>

<h2>Key Spring Maintenance Checklist</h2>
<ul>
  <li><strong>Blade Sharpening:</strong> Dull blades tear grass rather than cutting cleanly, leading to brown tips.</li>
  <li><strong>Engine Oil & Filter Change:</strong> Replace old oil to protect engine components.</li>
  <li><strong>Spark Plug & Air Filter Check:</strong> Ensure easy starting and optimal fuel efficiency.</li>
</ul>

<p>Discover our full range of <a href="https://briantsofrisborough.co.uk/lawnmowers">Lawnmowers & Robotic Mowers</a> or contact our service desk in Princes Risborough for expert assistance.</p>
`,
    image_placeholders: []
  }
];
