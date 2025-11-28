import { supabase } from '../config/supabase';

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; 

    // Fetch user profile data
    // Note: This assumes you have a 'profiles' table. 
    // If not, it will return null for 'profile', which is fine.
    const { data, error } = await supabase
      .from('profiles') 
      .select('*')
      .eq('id', userId)
      .single();

    // Ignore 'Row not found' errors (PGRST116)
    if (error && error.code !== 'PGRST116') { 
      throw error;
    }

    res.json({
      message: 'User profile fetched',
      user: req.user,       // Auth data (Email, ID)
      profile: data || null // Database data
    });

  } catch (error) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({ error: error.message });
  }
};