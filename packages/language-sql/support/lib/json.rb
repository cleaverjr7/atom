require 'json/common'
# = json - JSON for Ruby
#
# == Description
#
# This is a implementation of the JSON specification according to RFC 4627
# (http://www.ietf.org/rfc/rfc4627.txt). Starting from version 1.0.0 on there
# will be two variants available:
#
# * A pure ruby variant, that relies on the iconv and the stringscan
#   extensions, which are both part of the ruby standard library.
# * The quite a bit faster C extension variant, which is in parts implemented
#   in C and comes with its own unicode conversion functions and a parser
#   generated by the ragel state machine compiler
#   (http://www.cs.queensu.ca/~thurston/ragel).
#
# Both variants of the JSON generator escape all non-ASCII an control
# characters with \uXXXX escape sequences, and support UTF-16 surrogate pairs
# in order to be able to generate the whole range of unicode code points. This
# means that generated JSON text is encoded as UTF-8 (because ASCII is a subset
# of UTF-8) and at the same time avoids decoding problems for receiving
# endpoints, that don't expect UTF-8 encoded texts. On the negative side this
# may lead to a bit longer strings than necessarry.
#
# All strings, that are to be encoded as JSON strings, should be UTF-8 byte
# sequences on the Ruby side. To encode raw binary strings, that aren't UTF-8
# encoded, please use the to_json_raw_object method of String (which produces
# an object, that contains a byte array) and decode the result on the receiving
# endpoint.
#
# == Author
#
# Florian Frank <mailto:flori@ping.de>
#
# == License
#
# This software is distributed under the same license as Ruby itself, see
# http://www.ruby-lang.org/en/LICENSE.txt.
#
# == Download
#
# The latest version of this library can be downloaded at
#
# * http://rubyforge.org/frs?group_id=953
#
# Online Documentation should be located at
#
# * http://json.rubyforge.org
#
# == Usage
# 
# To use JSON you can
#   require 'json'
# to load the installed variant (either the extension 'json' or the pure
# variant 'json_pure'). If you have installed the extension variant, you can
# pick either the extension variant or the pure variant by typing
#   require 'json/ext'
# or
#   require 'json/pure'
#
# You can choose to load a set of common additions to ruby core's objects if
# you
#   require 'json/add/core'
#
# To get the best compatibility to rails' JSON implementation, you can
#   require 'json/add/rails'
#
# Both of the additions attempt to require 'json' (like above) first, if it has
# not been required yet.
#
# == Speed Comparisons
#
# I have created some benchmark results (see the benchmarks subdir of the
# package) for the JSON-Parser to estimate the speed up in the C extension:
#
# JSON::Pure::Parser::  28.90  calls/second
# JSON::Ext::Parser::  505.50 calls/second
#
# This is ca. <b>17.5</b> times the speed of the pure Ruby implementation.
#
# I have benchmarked the JSON-Generator as well. This generates a few more
# values, because there are different modes, that also influence the achieved
# speed:
#
# * JSON::Pure::Generator:
#   generate::        35.06 calls/second
#   pretty_generate:: 34.00 calls/second
#   fast_generate::   41.06 calls/second
#
# * JSON::Ext::Generator:
#   generate::        492.11 calls/second
#   pretty_generate:: 348.85 calls/second
#   fast_generate::   541.60 calls/second
#
# * Speedup Ext/Pure:
#   generate safe::   14.0 times
#   generate pretty:: 10.3 times
#   generate fast::   13.2 times
#
# The rails framework includes a generator as well, also it seems to be rather
# slow: I measured only 23.87 calls/second which is slower than any of my pure
# generator results. Here a comparison of the different speedups with the Rails
# measurement as the divisor:
#
# * Speedup Pure/Rails:
#   generate safe::   1.5 times
#   generate pretty:: 1.4 times
#   generate fast::   1.7 times
#
# * Speedup Ext/Rails:
#   generate safe::   20.6 times
#   generate pretty:: 14.6 times
#   generate fast::   22.7 times
#
# To achieve the fastest JSON text output, you can use the
# fast_generate/fast_unparse methods. Beware, that this will disable the
# checking for circular Ruby data structures, which may cause JSON to go into
# an infinite loop.
#
# == Examples
#
# To create a JSON text from a ruby data structure, you
# can call JSON.generate (or JSON.unparse) like that:
#
#  json = JSON.generate [1, 2, {"a"=>3.141}, false, true, nil, 4..10]
#  # => "[1,2,{\"a\":3.141},false,true,null,\"4..10\"]"
#
# It's also possible to call the #to_json method directly.
#
#  json = [1, 2, {"a"=>3.141}, false, true, nil, 4..10].to_json
#  # => "[1,2,{\"a\":3.141},false,true,null,\"4..10\"]"
#
# To create a valid JSON text you have to make sure, that the output is
# embedded in either a JSON array [] or a JSON object {}. The easiest way to do
# this, is by putting your values in a Ruby Array or Hash instance.
#
# To get back a ruby data structure from a JSON text, you have to call
# JSON.parse on it:
#
#  JSON.parse json
#  # => [1, 2, {"a"=>3.141}, false, true, nil, "4..10"]
# 
# Note, that the range from the original data structure is a simple
# string now. The reason for this is, that JSON doesn't support ranges
# or arbitrary classes. In this case the json library falls back to call
# Object#to_json, which is the same as #to_s.to_json.
#
# It's possible to extend JSON to support serialization of arbitrary classes by
# simply implementing a more specialized version of the #to_json method, that
# should return a JSON object (a hash converted to JSON with #to_json)
# like this (don't forget the *a for all the arguments):
#
#  class Range
#    def to_json(*a)
#      {
#        'json_class'   => self.class.name, # = 'Range'
#        'data'         => [ first, last, exclude_end? ]
#      }.to_json(*a)
#    end
#  end
#
# The hash key 'json_class' is the class, that will be asked to deserialize the
# JSON representation later. In this case it's 'Range', but any namespace of
# the form 'A::B' or '::A::B' will do. All other keys are arbitrary and can be
# used to store the necessary data to configure the object to be deserialized.
#
# If a the key 'json_class' is found in a JSON object, the JSON parser checks
# if the given class responds to the json_create class method. If so, it is
# called with the JSON object converted to a Ruby hash. So a range can
# be deserialized by implementing Range.json_create like this:
# 
#  class Range
#    def self.json_create(o)
#      new(*o['data'])
#    end
#  end
#
# Now it possible to serialize/deserialize ranges as well:
#
#  json = JSON.generate [1, 2, {"a"=>3.141}, false, true, nil, 4..10]
#  # => "[1,2,{\"a\":3.141},false,true,null,{\"json_class\":\"Range\",\"data\":[4,10,false]}]"
#  JSON.parse json
#  # => [1, 2, {"a"=>3.141}, false, true, nil, 4..10]
#
# JSON.generate always creates the shortest possible string representation of a
# ruby data structure in one line. This good for data storage or network
# protocols, but not so good for humans to read. Fortunately there's also
# JSON.pretty_generate (or JSON.pretty_generate) that creates a more
# readable output:
#
#  puts JSON.pretty_generate([1, 2, {"a"=>3.141}, false, true, nil, 4..10])
#  [
#    1,
#    2,
#    {
#      "a": 3.141
#    },
#    false,
#    true,
#    null,
#    {
#      "json_class": "Range",
#      "data": [
#        4,
#        10,
#        false
#      ]
#    }
#  ]
#
# There are also the methods Kernel#j for unparse, and Kernel#jj for
# pretty_unparse output to the console, that work analogous to Core Ruby's p
# and the pp library's pp methods.
#
# The script tools/server.rb contains a small example if you want to test, how
# receiving a JSON object from a webrick server in your browser with the
# javasript prototype library (http://www.prototypejs.org) works.
#
module JSON
  require 'json/version'

  if VARIANT_BINARY
    require 'json/ext'
  else
    begin
      require 'json/ext'
    rescue LoadError
      require 'json/pure'
    end
  end

  JSON_LOADED = true
end
