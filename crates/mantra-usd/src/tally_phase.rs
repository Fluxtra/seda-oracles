use anyhow::Result;

pub fn tally_phase() -> Result<()> {
    common::tally::standard_tally()
}
