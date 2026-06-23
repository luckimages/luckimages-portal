const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jrgflpemeezqgkmelzfd.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const contacts = [
  { name: "April Mayo", email: "april@mayopropertiesaustin.com", total_invoices: 1, total_revenue: 0 },
  { name: "Ashleigh Amoroso", email: "ashleigh@ashleighamoroso.com", total_invoices: 1, total_revenue: 150 },
  { name: "Beverly Ortiz", email: "support@512re.com", total_invoices: 20, total_revenue: 3294 },
  { name: "Candice Putter", email: "candiceputter1@gmail.com", total_invoices: 1, total_revenue: 150 },
  { name: "Carlos Flores", email: "texas.hm@gmail.com", total_invoices: 4, total_revenue: 855 },
  { name: "Christy Adams", email: "christyadams@kw.com", total_invoices: 1, total_revenue: 541 },
  { name: "Elizabeth Spiva", email: "elizabeth@thebear.us", total_invoices: 1, total_revenue: 2400 },
  { name: "Janice W", email: "janicefayew@gmail.com", total_invoices: 1, total_revenue: 500 },
  { name: "Jennifer Whitfield", email: "jenwhitfield13@gmail.com", total_invoices: 1, total_revenue: 250 },
  { name: "John Squires", email: "Johnsquires2@aol.com", total_invoices: 25, total_revenue: 7620 },
  { name: "Kimberly Mills", email: "kimmills2go@gmail.com", total_invoices: 1, total_revenue: 200 },
  { name: "Kris Luck", email: "kris@krisluck.com", total_invoices: 4, total_revenue: 1100 },
  { name: "Mackenzie Smith", email: "mack@mackenziepictures.com", total_invoices: 1, total_revenue: 140 },
  { name: "Michelle Bippus", email: "Michelle@ctxpg.com", total_invoices: 1, total_revenue: 240 },
  { name: "Michelle Garza", email: "support@512re.com", total_invoices: 14, total_revenue: 2273 },
  { name: "Mike Pauzer", email: "support@512re.com", total_invoices: 2, total_revenue: 411 },
  { name: "Moises Grimaldo", email: "mgbest@sbcglobal.net", total_invoices: 1, total_revenue: 200 },
  { name: "Adam Walker", email: "adam.walker@compass.com", total_invoices: 1, total_revenue: 150 },
  { name: "Allen Auth", email: "Aauth@theeraexperts.com", total_invoices: 1, total_revenue: 200 },
  { name: "Doyle Wilson", email: "Doylew51@gmail.com", total_invoices: 1, total_revenue: 450 },
  { name: "Frank Rainosek", email: "anita@bastropforsale.com", total_invoices: 1, total_revenue: 150 },
  { name: "Greg Gibson", email: "directeffecthomes@gmail.com", total_invoices: 1, total_revenue: 300 },
  { name: "Joel Ortiz", email: "rushrealtypr@gmail.com", total_invoices: 1, total_revenue: 150 },
  { name: "Kirk Moore", email: "Kirk-moore@realtytexas.com", total_invoices: 1, total_revenue: 150 },
  { name: "Luis Grimaldo", email: "luis@dreamwaytx.com", total_invoices: 6, total_revenue: 1480 },
  { name: "Mark Phillips", email: "mark.phillips70@gmail.com", total_invoices: 1, total_revenue: 200 },
  { name: "Sean Judge", email: "sean@m2propertygroup.net", total_invoices: 1, total_revenue: 280 },
  { name: "Trey Fitzpatrick", email: "Trey@thehornco.com", total_invoices: 1, total_revenue: 150 },
  { name: "Philip Cha", email: "mybrokerphilipcha@gmail.com", total_invoices: 1, total_revenue: 250 },
  { name: "Gay Lynn Wheeler", email: "gwheeler@hsbresortrealty.com", total_invoices: 1, total_revenue: 75 },
  { name: "Gisella Wenson", email: "Gisella.wenson@compass.com", total_invoices: 1, total_revenue: 150 },
  { name: "Iris Tombari", email: "iris@iristombari.com", total_invoices: 2, total_revenue: 450 },
  { name: "Jules Fernandez", email: "julesfernandez.texasrealtor@gmail.com", total_invoices: 2, total_revenue: 750 },
  { name: "Lucy Jordan Howard", email: "lucyjordanhoward@gmail.com", total_invoices: 1, total_revenue: 150 },
  { name: "Marge Hoff", email: "mmhoff5121@aol.com", total_invoices: 1, total_revenue: 100 },
  { name: "Mary Rodriguez", email: "Mary@austinrealhomes.com", total_invoices: 1, total_revenue: 150 },
  { name: "Mila Blanton", email: "Milablanton@yahoo.com", total_invoices: 1, total_revenue: 100 },
  { name: "Natasha Park", email: "nparkrealtor@gmail.com", total_invoices: 3, total_revenue: 800 },
  { name: "Suzie Adams", email: "suzie@suzieadams.com", total_invoices: 1, total_revenue: 150 },
  { name: "Nakia Strazzera", email: "support@512re.com", total_invoices: 2, total_revenue: 379 },
  { name: "Peach Reynolds", email: "peach@zilkerproperties.com", total_invoices: 1, total_revenue: 216 },
  { name: "Rachel Trimble", email: "Rachel@512re.com", total_invoices: 1, total_revenue: 400 },
  { name: "Valerie Pedraza", email: "valerie@darwinhomes.com", total_invoices: 1, total_revenue: 758 },
];

async function run() {
  // First create the contacts table via SQL
  const { error: tableError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS contacts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        email text,
        phone text,
        brokerage text,
        type text DEFAULT 'client',
        stage text DEFAULT 'client',
        notes text,
        total_invoices int DEFAULT 0,
        total_revenue numeric DEFAULT 0,
        is_hot boolean DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS cold_calls (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
        called_at timestamptz DEFAULT now(),
        outcome text, -- 'no_answer' | 'not_interested' | 'interested' | 'callback' | 'booked'
        notes text,
        listing_address text,
        callback_at timestamptz,
        called_by text DEFAULT 'ryan',
        created_at timestamptz DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS email_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
        subject text,
        body text,
        sent_at timestamptz DEFAULT now(),
        sent_by text DEFAULT 'ryan'
      );
    `
  });
  
  if (tableError) {
    console.log('Table creation note:', tableError.message);
  }

  const { data, error } = await supabase.from('contacts').upsert(
    contacts.map(c => ({ ...c, type: 'client', stage: 'client' })),
    { onConflict: 'email', ignoreDuplicates: false }
  ).select();

  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log(`✅ Inserted ${data.length} contacts`);
  }
}

run();
