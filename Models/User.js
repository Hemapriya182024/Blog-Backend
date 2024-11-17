const mongoose=require('mongoose');


const UserSchema=new mongoose.Schema(
    {
        username:{type:String,
            required:true,
            minLength: 4, 
            unique:true,
            match: /^[a-zA-Z0-9_]+$/
        },
        password:{type:String,
            required:true,
            minLength: 4, 
            unique:true,

        },

    }
)

const userModel=new mongoose.model('User',UserSchema);
module.exports=userModel